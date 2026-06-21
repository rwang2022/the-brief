import { useEffect, useState } from "react";

// Tiny transient toast, triggered by `window.dispatchEvent(new CustomEvent("brief:toast", {detail}))`.
export default function Toast() {
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let timer;
    const onToast = (e) => {
      setMsg(e.detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2200);
    };
    window.addEventListener("brief:toast", onToast);
    return () => {
      window.removeEventListener("brief:toast", onToast);
      clearTimeout(timer);
    };
  }, []);

  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}
