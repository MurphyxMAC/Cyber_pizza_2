import { Providers } from "../providers";

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
