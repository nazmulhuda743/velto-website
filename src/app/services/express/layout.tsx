import { ServiceViewTracker } from "@/components/analytics/ServiceViewTracker";

export default function ExpressLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceViewTracker service="express" />
      {children}
    </>
  );
}
