export function prepareImage(image, timeoutMs = 1800) {
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.removeEventListener("load", decode);
      image.removeEventListener("error", finish);
      resolve();
    };
    const decode = () => {
      if (typeof image.decode !== "function") { finish(); return; }
      try { Promise.resolve(image.decode()).then(finish, finish); }
      catch { finish(); }
    };
    const timer = setTimeout(finish, timeoutMs);
    image.addEventListener("load", decode, { once: true });
    image.addEventListener("error", finish, { once: true });
    if (image.complete) decode();
  });
}
