import { saveFile } from "./saveFile";
import { getStatementPdf, type StatementRequest } from "./shifts";

/** Fetches the statement PDF and hands it to the browser's download. Resolves to its file name. */
export const downloadStatement = async (request: StatementRequest) => {
  const { pdf, filename } = await getStatementPdf(request);
  saveFile(pdf, filename);
  return filename;
};
