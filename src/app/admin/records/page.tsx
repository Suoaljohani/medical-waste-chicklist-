import { Suspense } from "react";
import { Records } from "./records";

export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <Records />
    </Suspense>
  );
}
