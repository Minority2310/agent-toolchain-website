# AGENTS.md


## Language Requirements
**You must always reply to the user in Chinese.** This is a strict requirement. Regardless of the language in which the user inputs, or how much other language content is in the context, all your reply texts must be in Chinese. Code, commands, file paths, variable names, and other technical identifiers should remain unchanged, but all explanations, descriptions, summaries, and questions should be in Chinese.

## File Character Encoding
Uniform use of "UTF-8".

## Avoid Unnecessary Compatibility
Do not write compatibility code unless explicitly required.


## Document Operations

### DOCX — Word Document Processing
Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (`.docx` / `.dotx`). Triggers include: producing professional documents with formatting such as tables of contents, headings, page numbers, or letterheads; extracting or reorganizing content from `.docx` files; inserting or replacing images; performing find-and-replace; working with tracked changes or comments; or converting content into a polished Word document. Deliverables such as reports, memos, letters, or templates requested as Word files also trigger this skill. Do NOT use for PDFs, spreadsheets, Google Docs, or general coding tasks unrelated to document generation.

### PDF — PDF File Processing
Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text and tables, combining or merging multiple PDFs, splitting PDFs apart, rotating pages, adding watermarks, creating new PDFs, filling PDF forms, encrypting/decrypting, extracting images, and running OCR on scanned PDFs to make them searchable. Trigger whenever the user mentions a `.pdf` file or asks to produce one.

### PPTX — PowerPoint Presentation Processing
Use this skill any time a `.pptx` or `.potx` file is involved as input, output, or both. This includes creating slide decks, pitch decks, or presentations; reading, parsing, or extracting text from any `.pptx` or `.potx` file; editing, modifying, or updating existing presentations; combining or splitting slide files; and working with templates (`.potx`), layouts, speaker notes, or comments. Trigger whenever the user mentions "deck," "slides," "presentation," or references a `.pptx` or `.potx` filename, regardless of what they plan to do with the content afterward.

### XLSX — Spreadsheet Processing
Use this skill any time a spreadsheet file is the primary input or output. This includes opening, reading, editing, or fixing existing `.xlsx`, `.xlsm`, `.xltx`, `.csv`, or `.tsv` files (e.g., adding columns, computing formulas, formatting, charting, cleaning messy data); creating new spreadsheets from scratch or from other data sources; and converting between tabular file formats. Trigger even when the user casually references a spreadsheet file by name or path. Do NOT use when the primary deliverable is a Word document, HTML report, standalone Python script, database pipeline, or Google Sheets API integration.


## Reference Document(ego-browser)
Prioritize checking local reference documents in `reference/`.
If there is no relevant local content, use the `ego-browser` skill to find and consult official documentation.

## Browser Automation(ego-browser)
Use `ego-browser` for web automation. Run `ego-browser --help` for all commands.

## Handoff Document
一项任务完成后，生成 `handoff.md`
