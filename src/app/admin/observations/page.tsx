import { Suspense } from "react";
import { Observations } from "./observations";

export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <Observations />
    </Suspense>
  );
}
