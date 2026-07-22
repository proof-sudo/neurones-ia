"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { ClientsLive } from "./ClientsLive";
import { PartnersLive } from "./PartnersLive";
import type { ClientPortfolioItem } from "@/lib/api/clients";
import type { Supplier } from "@/lib/api/partners";

type PortefeuilleTab = "clients" | "partenaires";

export function PortefeuilleLive({
  clients,
  suppliers,
}: {
  clients: ClientPortfolioItem[];
  suppliers: Supplier[];
}) {
  const searchParams = useSearchParams();
  const clientParam = searchParams.get("client");
  const [tab, setTab] = useState<PortefeuilleTab>("clients");

  return (
    <>
      <ViewHeader
        eyebrow="● référentiel commercial"
        title="Portefeuille"
        sub="Clients et Fournisseurs — données réelles, regroupées en un seul endroit"
      />

      <SegmentedTabs
        tabs={[
          { key: "clients", label: "Clients" },
          { key: "partenaires", label: "Fournisseurs" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "clients" && <ClientsLive clients={clients} initialSelected={clientParam} />}
      {tab === "partenaires" && <PartnersLive suppliers={suppliers} />}
    </>
  );
}
