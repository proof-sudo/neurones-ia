"use client";

import { useState } from "react";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { VeilleView } from "./VeilleView";
import { VeilleClientView } from "./VeilleClientView";
import { VeilleAoView } from "./VeilleAoView";

type VeilleTab = "strategique" | "client" | "ao";

export function VeilleTabsView() {
  const [tab, setTab] = useState<VeilleTab>("strategique");

  return (
    <>
      <ViewHeader
        eyebrow="● intelligence commerciale"
        title="Veille"
        sub="Stratégique, prospection client et appels d'offres — regroupées en un seul endroit"
      />

      <SegmentedTabs
        tabs={[
          { key: "strategique", label: "Stratégique" },
          { key: "client", label: "Client" },
          { key: "ao", label: "Appels d'offres" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "strategique" && <VeilleView />}
      {tab === "client" && <VeilleClientView />}
      {tab === "ao" && <VeilleAoView />}
    </>
  );
}
