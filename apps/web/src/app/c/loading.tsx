export default function Loading() {
  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center overscroll-none"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #4b355d 0%, #1a1040 50%, #01004d 100%)" }}
    >
      <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
    </div>
  );
}
