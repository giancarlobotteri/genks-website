import { ArrowUpRight } from "lucide-react";
import { services } from "@/data/content";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
import { site } from "@/config/site";

const serviceHref: Record<string, string> = {
  recording: "/services/recording",
  mix: "/services/project?service=mix",
  master: "/services/project?service=master",
  "mix-master": "/services/project?service=mix_master",
  "custom-beat": site.instagram,
};

export function Services() {
  return (
    <section id="services" className="services-section container section">
      <SectionHeading
        index="03"
        eyebrow="BEYOND THE BEAT"
        title="Your vision. Our frequency."
      />
      <div className="service-list">
        {services.map((service) => (
          <Link
            key={service.id}
            className="service-row"
            href={serviceHref[service.id] ?? "/services"}
            target={service.id === "custom-beat" ? "_blank" : undefined}
            rel={service.id === "custom-beat" ? "noreferrer" : undefined}
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
