import QRCode from "qrcode";

export default async function TableReviewQr({ url }: { url: string | null }) {
  if (!url) return null;

  const qrDataUrl = await QRCode.toDataURL(url, {
    margin: 1,
    width: 160,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex shrink-0 flex-col items-center gap-1.5 rounded-2xl bg-slate-900 p-2.5 shadow-xl"
    >
      <p className="max-w-[6.5rem] text-center text-[10px] font-semibold leading-tight text-slate-400">
        QR para reseñas o nombre de empresa
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="Código QR para dejar una reseña en Google Maps" className="h-20 w-20 rounded" />
    </a>
  );
}
