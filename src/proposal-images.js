import { fail } from "./domain.js";
export const IMAGE_LIMIT = 5 * 1024 * 1024;
export function imageType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "image/png";
  const header = new TextDecoder().decode(bytes.slice(0, 12));
  if (header.startsWith("RIFF") && header.endsWith("WEBP")) return "image/webp";
  fail("invalid_image");
}
// The same Images binding and private WebP storage used by Community, owned here.
export async function proposalImage(bytes, processor) {
  if (!bytes.length || bytes.length > IMAGE_LIMIT) fail("file_too_large");
  imageType(bytes);
  if (!processor) fail("images_unavailable", 503);
  const stream = () => new Blob([bytes]).stream();
  let info;
  try {
    info = await processor.info(stream());
  } catch {
    fail("invalid_image");
  }
  if (
    !info.width ||
    !info.height ||
    info.width < 100 ||
    info.height < 100 ||
    info.width * info.height > 20000000
  )
    fail("image_dimensions");
  try {
    const output = await processor
      .input(stream())
      .transform({ width: 640, height: 640, fit: "cover" })
      .output({ format: "image/webp", quality: 82, anim: false });
    return new Uint8Array(await output.response().arrayBuffer());
  } catch {
    fail("images_unavailable", 503);
  }
}
