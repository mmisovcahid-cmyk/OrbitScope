import React, { useState } from 'react';
import SkyMapCanvas from '../components/skymap/SkyMapCanvas';
import ImageComparisonCard from '../components/dashboard/ImageComparisonCard';
import ObjectAnalysisCard from '../components/dashboard/ObjectAnalysisCard';
import {
  ObservationOverviewCard,
  MovingObjectsDetectedCard,
  PlanetXResearchCard,
  ObservationTimelineCard,
} from '../components/dashboard/RightSidebarCards';

export default function DashboardPage() {
  const [selectedCandidate, setSelectedCandidate] = useState<any>({
    id: '#0042',
    ra: 188.5,
    dec: -8.35,
    label: 'Candidate #0042',
    type: 'candidate',
    ra_str: '12h 34m',
    dec_str: "-08° 21'",
    confidence: 78,
  });

  return (
    <div className="p-4 md:p-5 flex flex-col xl:flex-row gap-4 min-h-full">
      {/* ============================================================ */}
      {/* CENTER WORKSPACE (Sky Map + Image Comparison + Analysis) */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Sky Map (Aitoff Projection with SPHEREx layers) */}
        <div className="h-[420px] w-full shrink-0">
          <SkyMapCanvas
            selectedId={selectedCandidate.id}
            onSelectCandidate={(m) => setSelectedCandidate(m)}
          />
        </div>

        {/* Bottom Row Cards: Image Comparison & Object Analysis */}
        <div className="flex flex-col lg:flex-row gap-4 flex-1">
          <ImageComparisonCard />
          <ObjectAnalysisCard
            candidateId={selectedCandidate.id}
            coordinates={`${selectedCandidate.ra_str || '12h 34m'} / ${selectedCandidate.dec_str || "-08° 21'"}`}
            confidence={selectedCandidate.confidence || 78}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT SIDEBAR COLUMN */}
      {/* ============================================================ */}
      <div className="w-full xl:w-80 shrink-0 flex flex-col gap-4">
        <ObservationOverviewCard />
        <MovingObjectsDetectedCard />
        <PlanetXResearchCard />
        <ObservationTimelineCard />
      </div>
    </div>
  );
}
