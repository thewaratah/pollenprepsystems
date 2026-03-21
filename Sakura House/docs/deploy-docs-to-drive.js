#!/usr/bin/env node
/**
 * deploy-docs-to-drive.js
 *
 * Converts Sakura House markdown docs to .docx (pure Node.js),
 * then uploads/overwrites them as Google Docs in a Drive folder.
 *
 * Usage:  node deploy-docs-to-drive.js
 *
 * Requires:
 *   - npm install (googleapis, markdown-it, docx)
 *   - Service account key at ~/.config/gcloud/service-account.json
 *   - Target Drive folder shared with the service account as Editor
 */

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const MarkdownIt = require("markdown-it");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} = require("docx");

// --- Config ---
const SERVICE_ACCOUNT_KEY = path.join(
  process.env.HOME,
  ".config/gcloud/service-account.json"
);
const DRIVE_FOLDER_ID = "12BQJ48X_9BXOSOWpY7oY_tv4VjKbJls5";
const DOCS_DIR = __dirname;
const DOCX_DIR = path.join(DOCS_DIR, "docx files");

// Staff/manager-facing docs to convert
const DOCS_TO_CONVERT = [
  "STAFF_GUIDE.md",
  "MANAGER_GUIDE.md",
  "NEW_STARTER_WELCOME.md",
  "TROUBLESHOOTING.md",
];

// --- Font & Style Config ---

const FONT = "Avenir";
const CODE_FONT = "Courier New";
const LINE_SPACING = 276; // 1.15 line spacing (240 twips = 1.0, so 1.15 = 276)

// Sizes in half-points (docx convention: 22 = 11pt)
const STYLES = {
  title: { font: FONT, size: 58, bold: true }, // 29pt
  h1: { font: FONT, size: 40 },                // 20pt
  h2: { font: FONT, size: 32 },                // 16pt
  h3: { font: FONT, size: 28 },                // 14pt
  h4: { font: FONT, size: 24 },                // 12pt
  normal: { font: FONT, size: 22 },            // 11pt
  code: { font: CODE_FONT, size: 20 },         // 10pt
};

const HEADING_STYLE = {
  1: STYLES.h1,
  2: STYLES.h2,
  3: STYLES.h3,
  4: STYLES.h4,
};

// --- Markdown to docx conversion ---

const md = new MarkdownIt();

function extractInlineText(tokens, parentBold = false, parentItalic = false, style = STYLES.normal) {
  const runs = [];
  let bold = parentBold;
  let italic = parentItalic;

  for (const token of tokens) {
    if (token.type === "strong_open") bold = true;
    else if (token.type === "strong_close") bold = parentBold;
    else if (token.type === "em_open") italic = true;
    else if (token.type === "em_close") italic = parentItalic;
    else if (token.type === "code_inline") {
      runs.push(
        new TextRun({
          text: token.content,
          font: CODE_FONT,
          size: STYLES.code.size,
          bold,
          italic,
        })
      );
    } else if (token.type === "softbreak") {
      runs.push(new TextRun({ text: "\n", break: 1, font: style.font, size: style.size }));
    } else if (token.type === "text" || token.type === "html_inline") {
      if (token.content) {
        runs.push(new TextRun({
          text: token.content,
          font: style.font,
          size: style.size,
          bold: bold || style.bold,
          italic,
        }));
      }
    }
  }
  return runs;
}

function convertMarkdownToDocx(markdown) {
  const tokens = md.parse(markdown, {});
  const children = [];
  let i = 0;
  let isFirstHeading = true;

  const lineSpacing = { line: LINE_SPACING };

  while (i < tokens.length) {
    const token = tokens[i];

    // Headings
    if (token.type === "heading_open") {
      const level = parseInt(token.tag.slice(1), 10);
      const inline = tokens[i + 1];

      // First H1 becomes the title (29pt bold)
      const isTitle = isFirstHeading && level === 1;
      const style = isTitle ? STYLES.title : (HEADING_STYLE[level] || STYLES.h4);
      if (isFirstHeading) isFirstHeading = false;

      const runs = extractInlineText(inline.children || [], style.bold || false, false, style);
      children.push(
        new Paragraph({
          spacing: lineSpacing,
          children: runs,
        })
      );
      i += 3;
      continue;
    }

    // Paragraphs
    if (token.type === "paragraph_open") {
      const inline = tokens[i + 1];
      const runs = extractInlineText(inline.children || [], false, false, STYLES.normal);
      children.push(new Paragraph({ spacing: lineSpacing, children: runs }));
      i += 3;
      continue;
    }

    // Bullet lists
    if (token.type === "bullet_list_open") {
      i++;
      while (i < tokens.length && tokens[i].type !== "bullet_list_close") {
        if (tokens[i].type === "list_item_open") {
          i++;
          while (
            i < tokens.length &&
            tokens[i].type !== "list_item_close"
          ) {
            if (tokens[i].type === "paragraph_open") {
              const inline = tokens[i + 1];
              const runs = extractInlineText(inline.children || [], false, false, STYLES.normal);
              children.push(
                new Paragraph({
                  bullet: { level: 0 },
                  spacing: lineSpacing,
                  children: runs,
                })
              );
              i += 3;
            } else {
              i++;
            }
          }
        }
        i++;
      }
      i++; // bullet_list_close
      continue;
    }

    // Ordered lists
    if (token.type === "ordered_list_open") {
      i++;
      let ordNum = 0;
      while (i < tokens.length && tokens[i].type !== "ordered_list_close") {
        if (tokens[i].type === "list_item_open") {
          ordNum++;
          i++;
          while (
            i < tokens.length &&
            tokens[i].type !== "list_item_close"
          ) {
            if (tokens[i].type === "paragraph_open") {
              const inline = tokens[i + 1];
              const runs = extractInlineText(inline.children || [], false, false, STYLES.normal);
              children.push(
                new Paragraph({
                  numbering: { reference: "default-numbering", level: 0 },
                  spacing: lineSpacing,
                  children: runs,
                })
              );
              i += 3;
            } else {
              i++;
            }
          }
        }
        i++;
      }
      i++;
      continue;
    }

    // Code blocks / fences
    if (token.type === "fence" || token.type === "code_block") {
      children.push(
        new Paragraph({
          spacing: lineSpacing,
          children: [
            new TextRun({
              text: token.content.trimEnd(),
              font: CODE_FONT,
              size: STYLES.code.size,
            }),
          ],
          shading: { fill: "f5f5f5" },
        })
      );
      i++;
      continue;
    }

    // Tables
    if (token.type === "table_open") {
      // First pass: collect raw row data (cells as arrays of runs)
      const rawRows = [];
      i++;
      while (i < tokens.length && tokens[i].type !== "table_close") {
        if (
          tokens[i].type === "thead_open" ||
          tokens[i].type === "tbody_open" ||
          tokens[i].type === "thead_close" ||
          tokens[i].type === "tbody_close"
        ) {
          i++;
          continue;
        }
        if (tokens[i].type === "tr_open") {
          const rowCells = [];
          const isHeader = rawRows.length === 0;
          i++;
          while (i < tokens.length && tokens[i].type !== "tr_close") {
            if (
              tokens[i].type === "th_open" ||
              tokens[i].type === "td_open"
            ) {
              i++;
              const inline = tokens[i];
              const runs = extractInlineText(
                inline.children || [],
                isHeader,
                false,
                STYLES.normal
              );
              rowCells.push({ runs, isHeader });
              i += 2; // inline + th_close/td_close
              continue;
            }
            i++;
          }
          if (rowCells.length > 0) {
            rawRows.push(rowCells);
          }
          i++; // tr_close
          continue;
        }
        i++;
      }

      // Second pass: build Table with correct column widths and borders
      if (rawRows.length > 0) {
        const colCount = rawRows[0].length;
        const cellBorders = {
          top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
        };

        const tableRows = rawRows.map((row) =>
          new TableRow({
            children: row.map(
              ({ runs }) =>
                new TableCell({
                  children: [new Paragraph({ spacing: lineSpacing, children: runs })],
                  width: {
                    size: Math.floor(100 / colCount),
                    type: WidthType.PERCENTAGE,
                  },
                  borders: cellBorders,
                })
            ),
          })
        );

        children.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }
      i++; // table_close
      continue;
    }

    // Horizontal rule
    if (token.type === "hr") {
      children.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" },
          },
          children: [],
        })
      );
      i++;
      continue;
    }

    // Skip everything else
    i++;
  }

  return new Document({
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });
}

// --- Main ---

async function main() {
  // 1. Ensure docx output directory exists
  if (!fs.existsSync(DOCX_DIR)) {
    fs.mkdirSync(DOCX_DIR, { recursive: true });
  }

  // 2. Convert markdown to docx
  console.log("Converting markdown to docx...");
  const docxFiles = [];
  for (const mdFile of DOCS_TO_CONVERT) {
    const mdPath = path.join(DOCS_DIR, mdFile);
    if (!fs.existsSync(mdPath)) {
      console.warn(`  SKIP: ${mdFile} not found`);
      continue;
    }
    const markdown = fs.readFileSync(mdPath, "utf8");
    const doc = convertMarkdownToDocx(markdown);
    const baseName = mdFile.replace(/\.md$/, "");
    const docxPath = path.join(DOCX_DIR, `${baseName}.docx`);
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(docxPath, buffer);
    console.log(`  OK: ${mdFile} -> ${baseName}.docx`);
    docxFiles.push({ name: `${baseName}.docx`, path: docxPath });
  }

  if (docxFiles.length === 0) {
    console.log("No files to upload.");
    return;
  }

  // 3. Authenticate with Google Drive API
  console.log("\nAuthenticating with Google Drive...");
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_KEY,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const drive = google.drive({ version: "v3", auth });

  // 4. List existing files in the target folder (to overwrite, not duplicate)
  const existing = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and trashed = false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existingByName = {};
  for (const file of existing.data.files || []) {
    existingByName[file.name] = file.id;
  }

  // 5. Upload or update each docx file
  console.log("Uploading to Google Drive...");
  for (const { name, path: filePath } of docxFiles) {
    const media = {
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: fs.createReadStream(filePath),
    };

    const docName = name.replace(/\.docx$/, "");

    if (existingByName[docName]) {
      // Update existing file (overwrite content)
      const fileId = existingByName[docName];
      await drive.files.update({ fileId, media, supportsAllDrives: true });
      console.log(`  UPDATED: ${docName} (${fileId})`);
    } else {
      // Create new file in folder, converting to Google Docs format
      const res = await drive.files.create({
        requestBody: {
          name: docName,
          parents: [DRIVE_FOLDER_ID],
          mimeType: "application/vnd.google-apps.document",
        },
        media,
        fields: "id",
        supportsAllDrives: true,
      });
      console.log(`  CREATED: ${docName} (${res.data.id})`);
    }
  }

  console.log("\nDone! Docs deployed to Google Drive.");
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
