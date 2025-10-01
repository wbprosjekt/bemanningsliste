import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold">Siden ble ikke funnet</h2>
        <p className="text-muted-foreground max-w-md">
          Siden du leter etter eksisterer ikke eller har blitt flyttet.
        </p>
        <Button asChild>
          <Link href="/">Gå til forsiden</Link>
        </Button>
      </div>
    </div>
  );
}


