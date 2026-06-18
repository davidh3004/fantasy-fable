import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);

export type UploadResult =
  | { url: string; error?: never }
  | { url?: never; error: "file_type" | "file_size" | "upload_failed" };

/**
 * Uploads an image to the public `media` bucket using the caller's session
 * (storage policies restrict writes to admins). Returns the public URL.
 */
export async function uploadImage(
  file: File,
  folder: "clubs" | "players"
): Promise<UploadResult> {
  const ext = ALLOWED.get(file.type);
  if (!ext) return { error: "file_type" };
  if (file.size > MAX_BYTES) return { error: "file_size" };

  const supabase = await createClient();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("media")
    .upload(path, file, { contentType: file.type });

  if (error) {
    console.error("storage upload failed:", error.message);
    return { error: "upload_failed" };
  }

  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { url: data.publicUrl };
}

/** A File field from FormData that actually contains a selected file. */
export function pickedFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}
