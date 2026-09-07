export function isAcceptedUploadName(filename: string): boolean {
  return /\.(csv|tsv|txt|xlsx|xls|html|htm)$/i.test(filename);
}
