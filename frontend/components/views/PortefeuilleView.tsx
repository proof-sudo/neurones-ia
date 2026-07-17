"use client";

import { useState } from "react";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { LeadsView } from "./LeadsView";
import { ClientsView } from "./ClientsView";
import { PartnersView } from "./PartnersView";

type PortefeuilleTab = "leads" | "clients" | "partenaires";

export function PortefeuilleView() {
  const [tab, setTab] = useState<PortefeuilleTab>("clients");

  return (
    <>
      <ViewHeader
        eyebrow="● référentiel commercial"
        title="Portefeuille"
        sub="Leads, Clients et Partenaires — regroupés en un seul endroit"
      />

      <SegmentedTabs
        tabs={[
          { key: "leads", label: "Leads" },
          { key: "clients", label: "Clients" },
          { key: "partenaires", label: "Fournisseurs" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "leads" && <LeadsView />}
      {tab === "clients" && <ClientsView />}
      {tab === "partenaires" && <PartnersView />}
    </>
  );
}
