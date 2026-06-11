import {
  PENDING_INDEX,
  PUBLIC_INDEX,
  addToIndex,
  cleanTags,
  cleanText,
  error,
  json,
  putItem,
  requireStore,
  safeFilename,
  validateFile,
} from "./_lib.js";

export async function onRequestPost({ request, env }) {
  const store = requireStore(env);
  if (store.missing) return store.response;

  let form;
  try {
    form = await request.formData();
  } catch (err) {
    return error("Invalid multipart form upload.");
  }

  const file = form.get("file");
  const fileError = validateFile(file);
  if (fileError) return error(fileError);

  const releaseConsent = form.get("releaseConsent") === "yes";
  const rightsConsent = form.get("rightsConsent") === "yes";
  if (!releaseConsent || !rightsConsent) {
    return error("Contributor rights and free release confirmations are required.");
  }

  const id = crypto.randomUUID();
  const filename = safeFilename(file.name, file.type);
  const objectKey = `community/${id}/${filename}`;
  const status = env.AUTO_PUBLISH_STOCK_UPLOADS === "true" ? "public" : "pending";
  const now = new Date().toISOString();

  const item = {
    id,
    objectKey,
    filename,
    status,
    title: cleanText(form.get("title"), filename.replace(/\.[^.]+$/, ""), 120),
    author: cleanText(form.get("author"), "Anonymous contributor", 80),
    category: cleanText(form.get("category"), "Community", 40),
    license: cleanText(form.get("license"), "FreeDesignStore Free Release", 80),
    tags: cleanTags(form.get("tags")),
    contentType: file.type,
    size: file.size,
    createdAt: now,
    updatedAt: now,
  };

  await store.bucket.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
      contentDisposition: `inline; filename="${filename}"`,
    },
    customMetadata: {
      stockId: id,
      status,
      author: item.author,
      license: item.license,
    },
  });
  await putItem(store.kv, item);
  await addToIndex(store.kv, status === "public" ? PUBLIC_INDEX : PENDING_INDEX, id);

  return json({
    ok: true,
    status,
    id,
    message:
      status === "public"
        ? "Photo published."
        : "Photo submitted for review.",
  });
}
