import {
  ExternalLinkIcon,
  NavigationIcon,
  PlugZapIcon,
  ZapIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { directionsUrl, formatDistance } from "@/features/marketplace/format";

import { connectorLabels, type Station } from "../types";

const kw = (value: number) => `${value.toLocaleString("bg-BG")} kW`;

export function StationCard({
  station,
  showDistance,
}: {
  station: Station;
  showDistance: boolean;
}) {
  const place = [station.address, station.town].filter(Boolean).join(", ");
  return (
    <article
      aria-labelledby={`station-${station.id}`}
      className="grid gap-3 rounded-lg border bg-card p-4 shadow-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`station-${station.id}`} className="font-semibold">
            {station.name}
          </h3>
          {station.operator && (
            <p className="text-sm text-muted-foreground">{station.operator}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {station.max_power_kw !== null && (
            <Badge variant={station.has_dc ? "default" : "secondary"}>
              <ZapIcon aria-hidden="true" />
              до {kw(station.max_power_kw)}
            </Badge>
          )}
          {station.has_dc && <Badge variant="outline">DC</Badge>}
          {station.has_ac && <Badge variant="outline">AC</Badge>}
        </div>
      </div>

      {(place || showDistance) && (
        <p className="text-sm text-muted-foreground">
          {place}
          {showDistance && station.distance_km !== null && (
            <span className="ml-1.5 inline-flex items-center gap-1 font-medium text-foreground">
              <NavigationIcon className="size-3" aria-hidden="true" />
              {formatDistance(station.distance_km)}
            </span>
          )}
        </p>
      )}

      {station.connectors.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm" aria-label="Конектори">
          {station.connectors.map((connector, index) => (
            <li
              key={index}
              className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1"
            >
              <PlugZapIcon className="size-3.5" aria-hidden="true" />
              {connectorLabels[connector.type]}
              {connector.power_kw !== null && ` · ${kw(connector.power_kw)}`}
              {connector.quantity > 1 && ` × ${connector.quantity}`}
            </li>
          ))}
        </ul>
      )}

      <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
        {station.status_text && (
          <>
            <dt className="text-muted-foreground">Статус по източника</dt>
            <dd>{station.status_text}</dd>
          </>
        )}
        {station.usage_type && (
          <>
            <dt className="text-muted-foreground">Достъп</dt>
            <dd>{station.usage_type}</dd>
          </>
        )}
        {station.pricing_text && (
          <>
            <dt className="text-muted-foreground">Цена</dt>
            <dd>{station.pricing_text}</dd>
          </>
        )}
        {station.source_updated_at && (
          <>
            <dt className="text-muted-foreground">Обновено при източника</dt>
            <dd>
              {new Intl.DateTimeFormat("bg-BG", {
                dateStyle: "medium",
                timeZone: "Europe/Sofia",
              }).format(new Date(station.source_updated_at))}
            </dd>
          </>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a
            href={directionsUrl(station.lat, station.lng)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <NavigationIcon aria-hidden="true" />
            Упътване
          </a>
        </Button>
        {station.source_url && (
          <Button asChild size="sm" variant="outline">
            <a
              href={station.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLinkIcon aria-hidden="true" />
              Източник
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}
