import { Expense } from "./types";

let cachedSpreadsheetId: string | null = localStorage.getItem("google_spreadsheet_id");
let cachedFolderId: string | null = localStorage.getItem("google_receipts_folder_id");

const DEFAULT_SPREADSHEET_ID = "17CyWN68zCkijc1drXUbIFbHXs76I5ayEexWB6GpdKak";

/**
 * Gets the currently cached spreadsheet ID or defaults to the original setup.
 */
export function getSpreadsheetId(): string {
  return cachedSpreadsheetId || localStorage.getItem("google_spreadsheet_id") || DEFAULT_SPREADSHEET_ID;
}

/**
 * Resolves the LedgerStream spreadsheet ID. Searches Drive for 'LedgerStream - Expense Tracker'.
 * If not found, creates it and initializes headers on a 'DATA' sheet.
 */
export async function resolveSpreadsheetId(accessToken: string): Promise<string> {
  const cached = cachedSpreadsheetId || localStorage.getItem("google_spreadsheet_id");
  if (cached) {
    // Quickly verify if the spreadsheet is accessible
    try {
      const verifyRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cached}?fields=spreadsheetId`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (verifyRes.ok) {
        cachedSpreadsheetId = cached;
        return cached;
      }
    } catch (e) {
      console.warn("Cached spreadsheet verification failed:", e);
    }
  }

  // Search Drive for a spreadsheet named "LedgerStream - Expense Tracker"
  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='LedgerStream - Expense Tracker' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        const foundId = data.files[0].id;
        cachedSpreadsheetId = foundId;
        localStorage.setItem("google_spreadsheet_id", foundId);
        return foundId;
      }
    }
  } catch (err) {
    console.error("Error searching spreadsheet in Drive:", err);
  }

  // If not found, create a new one!
  try {
    console.log("Creating new 'LedgerStream - Expense Tracker' spreadsheet...");
    const createRes = await fetch(
      "https://sheets.googleapis.com/v4/spreadsheets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            title: "LedgerStream - Expense Tracker",
          },
          sheets: [
            {
              properties: {
                title: "DATA",
              },
            },
          ],
        }),
      }
    );

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create spreadsheet: ${errText}`);
    }

    const newSpreadsheet = await createRes.json();
    const newId = newSpreadsheet.spreadsheetId;
    if (!newId) {
      throw new Error("Created spreadsheet has no ID returned.");
    }

    cachedSpreadsheetId = newId;
    localStorage.setItem("google_spreadsheet_id", newId);

    // Write initial headers
    const headers = ["Date", "Item", "Amount", "Category", "Receipt Link", "Receipt Name"];
    const headerRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${newId}/values/DATA!A1:F1?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [headers],
        }),
      }
    );

    if (!headerRes.ok) {
      const errorText = await headerRes.text();
      console.warn("Failed to initialize headers in new spreadsheet:", errorText);
    }

    return newId;
  } catch (err) {
    console.error("Fallback spreadsheet creator failed, using default:", err);
    return DEFAULT_SPREADSHEET_ID;
  }
}

/**
 * Resolves the parent receipts folder ID by searching for 'LedgerStream - Receipts'.
 * Creates it if not found, or returns null if it cannot create it.
 */
export async function resolveFolderId(accessToken: string): Promise<string | null> {
  const cached = cachedFolderId || localStorage.getItem("google_receipts_folder_id");
  if (cached) {
    try {
      const verifyRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${cached}?fields=id`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (verifyRes.ok) {
        cachedFolderId = cached;
        return cached;
      }
    } catch (e) {
      console.warn("Cached folder verification failed:", e);
    }
  }

  // Search for "LedgerStream - Receipts"
  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='LedgerStream - Receipts' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        const foundId = data.files[0].id;
        cachedFolderId = foundId;
        localStorage.setItem("google_receipts_folder_id", foundId);
        return foundId;
      }
    }
  } catch (err) {
    console.error("Error searching folder in Drive:", err);
  }

  // Create folder
  try {
    const createRes = await fetch(
      "https://www.googleapis.com/drive/v3/files",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "LedgerStream - Receipts",
          mimeType: "application/vnd.google-apps.folder",
        }),
      }
    );

    if (createRes.ok) {
      const folderData = await createRes.json();
      if (folderData.id) {
        cachedFolderId = folderData.id;
        localStorage.setItem("google_receipts_folder_id", folderData.id);
        return folderData.id;
      }
    }
  } catch (err) {
    console.error("Failed to create Receipts folder:", err);
  }

  return null;
}

// Types for Sheets API
interface SpreadsheetMetadata {
  sheets?: {
    properties?: {
      title?: string;
    };
  }[];
}

interface ValueRange {
  values?: string[][];
}

/**
 * Ensures the 'DATA' sheet exists in the spreadsheet. If not, it creates it and initializes headers.
 */
export async function ensureDataSheetExists(accessToken: string): Promise<boolean> {
  try {
    const spreadsheetId = await resolveSpreadsheetId(accessToken);
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!metaRes.ok) {
      const errorText = await metaRes.text();
      throw new Error(`Failed to fetch spreadsheet metadata: ${errorText}`);
    }

    const metadata: SpreadsheetMetadata = await metaRes.json();
    const hasDataSheet = metadata.sheets?.some(
      (s) => s.properties?.title === "DATA"
    );

    if (!hasDataSheet) {
      console.log("'DATA' sheet not found. Creating it...");
      // Create the sheet
      const createRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: "DATA",
                  },
                },
              },
            ],
          }),
        }
      );

      if (!createRes.ok) {
        const errorText = await createRes.text();
        throw new Error(`Failed to create 'DATA' sheet: ${errorText}`);
      }

      // Add Headers
      const headers = ["Date", "Item", "Amount", "Category", "Receipt Link", "Receipt Name"];
      const headerRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DATA!A1:F1?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [headers],
          }),
        }
      );

      if (!headerRes.ok) {
        const errorText = await headerRes.text();
        throw new Error(`Failed to initialize headers: ${errorText}`);
      }
    }

    return true;
  } catch (error) {
    console.error("ensureDataSheetExists error:", error);
    throw error;
  }
}

/**
 * Reads all entries from the DATA sheet.
 */
export async function getExpensesFromSheet(accessToken: string): Promise<Expense[]> {
  try {
    await ensureDataSheetExists(accessToken);
    const spreadsheetId = await resolveSpreadsheetId(accessToken);

    const valuesRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DATA!A2:F1000`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!valuesRes.ok) {
      const errorText = await valuesRes.text();
      throw new Error(`Failed to fetch values from DATA sheet: ${errorText}`);
    }

    const data: ValueRange = await valuesRes.json();
    if (!data.values || data.values.length === 0) {
      return [];
    }

    // Convert rows to Expense objects
    return data.values.map((row, index) => {
      return {
        id: `row-${index + 2}`, // 1-indexed spreadsheet row + 1 (since we skipped header row 1)
        date: row[0] || "",
        item: row[1] || "",
        amount: isNaN(parseFloat(row[2])) ? 0 : parseFloat(row[2]),
        category: row[3] || "Unknown",
        receiptUrl: row[4] || "",
        receiptName: row[5] || "",
      };
    });
  } catch (error) {
    console.error("getExpensesFromSheet error:", error);
    throw error;
  }
}

/**
 * Appends a new expense entry row to the DATA sheet.
 */
export async function appendExpenseToSheet(
  accessToken: string,
  expense: Omit<Expense, "id">
): Promise<boolean> {
  try {
    await ensureDataSheetExists(accessToken);
    const spreadsheetId = await resolveSpreadsheetId(accessToken);

    const row = [
      expense.date,
      expense.item,
      expense.amount.toString(),
      expense.category,
      expense.receiptUrl || "",
      expense.receiptName || "",
    ];

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DATA!A:F:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [row],
        }),
      }
    );

    if (!appendRes.ok) {
      const errorText = await appendRes.text();
      throw new Error(`Failed to append expense to sheet: ${errorText}`);
    }

    return true;
  } catch (error) {
    console.error("appendExpenseToSheet error:", error);
    throw error;
  }
}

/**
 * Helper to upload a receipt file to Google Drive and return the file metadata and links.
 */
export async function uploadReceiptToDrive(
  accessToken: string,
  file: File,
  customName?: string
): Promise<{ id: string; name: string; webViewLink: string }> {
  try {
    const boundary = "314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const fileReaderPromise = new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });

    const fileContent = await fileReaderPromise;
    const contentType = file.type || "application/octet-stream";

    const getFileExtension = (filename: string) => {
      const parts = filename.split(".");
      return parts.length > 1 ? `.${parts.pop()}` : "";
    };

    const finalName = customName 
      ? `${customName}${getFileExtension(file.name)}` 
      : `Receipt_${Date.now()}_${file.name}`;

    const folderId = await resolveFolderId(accessToken);
    const metadata: any = {
      name: finalName,
      mimeType: contentType,
    };

    if (folderId) {
      metadata.parents = [folderId];
    }

    const metadataPart = JSON.stringify(metadata);

    const parts = [
      new Blob([
        delimiter +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          metadataPart +
          "\r\n" +
          delimiter,
      ]),
      new Blob([`Content-Type: ${contentType}\r\n\r\n`]),
      new Blob([fileContent]),
      new Blob([closeDelimiter]),
    ];

    const body = new Blob(parts);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: body,
      }
    );

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      throw new Error(`Google Drive upload failed: ${errorText}`);
    }

    const driveFile = await uploadRes.json();

    // Set permission to anyone with link, so the receipt can be viewed via the Google Sheet link.
    try {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: "reader",
            type: "anyone",
          }),
        }
      );
    } catch (permError) {
      console.warn("Failed to set shareable permission, skipping:", permError);
    }

    return {
      id: driveFile.id,
      name: driveFile.name,
      webViewLink: driveFile.webViewLink,
    };
  } catch (error) {
    console.error("uploadReceiptToDrive error:", error);
    throw error;
  }
}
