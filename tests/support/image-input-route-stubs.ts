export const imageInputRouteState = { uploads: [] as File[] };
export async function getCurrentUser() {
  return null;
}
export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
export async function uploadToR2(file: File) {
  imageInputRouteState.uploads.push(file);
  return "https://files.example.test/uploaded.png";
}
