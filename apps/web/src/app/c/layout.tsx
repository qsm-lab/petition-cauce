import CBodyFix from "./CBodyFix";

export default function CLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ background: "#01004d", minHeight: "100dvh" }}
      className="overscroll-none"
    >
      <CBodyFix />
      {children}
    </div>
  );
}
