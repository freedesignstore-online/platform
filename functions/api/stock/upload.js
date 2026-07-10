import {
  PENDING_INDEX,
  PUBLIC_INDEX,
  accountIndexKey,
  addToIndex,
  cleanAssetType,
  cleanTags,
  cleanText,
  ensureProfile,
  error,
  fileBytes,
  json,
  putItem,
  requireStore,
  safeFilename,
  sessionAccount,
  validateFile,
} from "./_lib.js";

export async function onRequestPost({ request, env }) {
  const store = requireStore(env);
  if (store.missing) return store.response;

  const account = await sessionAccount(request, env);
  if (!account?.authenticated) {
    return error("Sign in to contribute. Visit /.fds/auth/start to sign in with GitHub or Google.", 401);
  }

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
  const status = env.AUTO_PUBLISH_STOCK_UPLOADS === "false" ? "pending" : "public";
  const now = new Date().toISOString();

  const item = {
    id,
    objectKey,
    filename,
    status,
    title: cleanText(form.get("title"), filename.replace(/\.[^.]+$/, ""), 120),
    author: cleanText(account.accountName, "Contributor", 80),
    category: cleanText(form.get("category"), "Community", 40),
    assetType: cleanAssetType(form.get("assetType")),
    license: cleanText(form.get("license"), "FreeDesignStore Free Release", 80),
    tags: cleanTags(form.get("tags")),
    contentType: file.type,
    size: file.size,
    source: "community",
    ownerAccountId: account.accountId,
    ownerName: cleanText(account.accountName, "Contributor", 80),
    createdAt: now,
    updatedAt: now,
  };

  let body;
  try {
    body = await fileBytes(file);
  } catch (err) {
    return error(err.message);
  }

  await store.bucket.put(objectKey, body, {
    httpMetadata: {
      contentType: file.type,
      contentDisposition: `inline; filename="${filename}"`,
    },
    customMetadata: {
      stockId: id,
      status,
      assetType: item.assetType,
      author: item.author,
      license: item.license,
    },
  });
  await putItem(store.kv, item);
  await addToIndex(store.kv, status === "public" ? PUBLIC_INDEX : PENDING_INDEX, id);
  await addToIndex(store.kv, accountIndexKey(account.accountId), id);
  await ensureProfile(store.kv, account);

  return json({
    ok: true,
    status,
    id,
    message:
      status === "public"
        ? "Asset published."
        : "Asset submitted for review.",
  });
}
