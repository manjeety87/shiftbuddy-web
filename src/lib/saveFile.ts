/** Hands a file to the browser's download, under `name`. */
export const saveFile = (file: Blob, name: string) => {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // After the click has handed the file to the browser
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
