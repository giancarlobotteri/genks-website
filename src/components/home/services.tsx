import { ArrowUpRight } from "lucide-react";
import { services } from "@/data/content";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";

const serviceHref: Record<string, string> = {
  recording: "/services/recording",
  mix: "/services/project?service=mix",
  master: "/services/project?service=master",
  "mix-master": "/services/project",
  "custom-beat": "/services/custom",
};

export function Services() {
  return (
    <section id="services" className="services-section container section">
      <SectionHeading
        index="03"
        eyebrow="OLTRE IL BEAT"
        title="La tua visione. La nostra frequenza."
      />
      <div className="service-list">
        {services.map((service) => (
          <Link
            key={service.id}
            className="service-row"
            href={serviceHref[service.id] ?? "/services"}
            data-reveal
          >
            <span className="mono service-number">{service.number}</span>
            <h3>{service.title}</h3>
            <p>{service.description}</p>
            <span className="service-arrow">
              <ArrowUpRight size={27} strokeWidth={1.4} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
