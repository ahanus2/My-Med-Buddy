import { getSupabaseBrowserClient } from "@/lib/supabase";

const RECORD_BUCKET = "medical-record-files";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export async function uploadPrivateRecordFile(userId: string, recordId: string, file: File) {
  const supabase = getSupabaseBrowserClient();
  const filePath = `${userId}/${recordId}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(RECORD_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined
  });

  if (error) {
    throw error;
  }

  return filePath;
}

export async function uploadPrivateMessageAttachment(userId: string, messageId: string, file: File) {
  const supabase = getSupabaseBrowserClient();
  const filePath = `${userId}/messages/${messageId}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(RECORD_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined
  });

  if (error) {
    throw error;
  }

  return filePath;
}

export async function createSignedRecordUrl(storagePath: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.storage.from(RECORD_BUCKET).createSignedUrl(storagePath, 60);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
