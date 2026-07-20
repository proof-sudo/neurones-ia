"use client";

import { useState } from "react";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { ClientsView } from "./ClientsView";
import { PartnersView } from "./PartnersView";

type PortefeuilleTab = "clients" | "partenaires";

export function PortefeuilleView() {
  const [tab, setTab] = useState<PortefeuilleTab>("clients");

  return (
    <>
      <ViewHeader
        eyebrow="● référentiel commercial"
        title="Portefeuille"
        sub="Clients et Fournisseurs — regroupés en un seul endroit"
      />

      <SegmentedTabs
        tabs={[
          { key: "clients", label: "Clients" },
          { key: "partenaires", label: "Fournisseurs" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "clients" && <ClientsView />}
      {tab === "partenaires" && <PartnersView />}
    </>
  );
}
