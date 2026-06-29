import { Suspense } from "react";
import NewFormClient from "./NewFormClient";

export default function NewFormPage() {
  return (
    <Suspense fallback={null}>
      <NewFormClient />
    </Suspense>
  );
}
