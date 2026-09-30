import { validateEvent } from "../src/domain.js";
export async function seedDemo(db) {
  const existing = await db.prepare("SELECT COUNT(*) AS n FROM events").first();
  if (existing.n) return;
  const dateAt = (days) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const base = {
    status: "published",
    date: dateAt(9),
    time: "19:00",
    endTime: "21:00",
    mode: "walkin",
    price: "Free entry",
    priceEs: "Entrada gratuita",
    image: "",
    details: "",
    description: "",
    titleEs: "",
    descriptionEs: "",
  };
  const fixtures = [
    {
      ...base,
      slug: "short-films-long-conversations",
      title: "Short films.\nLong conversations.",
      titleEs: "Cortos y largas conversaciones.",
      details: "An evening of short films & conversation",
      detailsEs: "Una noche de cortometrajes y conversación",
      image: "/assets/sample-shorts.svg",
      imageAlt: "Blue film-reel illustration for the sample shorts programme",
      imageAltEs:
        "Ilustración azul de un rollo de película para el programa de ejemplo",
      description:
        "A few films, a room full of curious people, and plenty to talk about. Join us for an evening of short-form cinema followed by an open conversation.\n\nThis is a sample listing for the local website preview. The programme, date, and admission details are illustrative.",
      descriptionEs:
        "Varias películas, una sala llena de gente curiosa y mucho de qué hablar. Una noche de cortometrajes seguida de una conversación abierta.\n\nEste es un evento de ejemplo para la vista previa local. El programa, la fecha y la entrada son ilustrativos.",
    },
    {
      ...base,
      date: dateAt(16),
      slug: "in-the-edit",
      title: "In the edit",
      titleEs: "En la sala de montaje",
      mode: "rsvp",
      url: "https://shop.dustwave.xyz/",
      price: "Free · RSVP required",
      priceEs: "Gratis · Con reserva",
      details: "Works in progress / artist conversation",
      detailsEs: "Obras en proceso / charla con artistas",
      description:
        "An informal look at films taking shape, with space for questions, ideas, and feedback.\n\nSample listing only. This event and the linked shop destination are not a real reservation offer.",
      descriptionEs:
        "Una mirada informal a películas en proceso, con espacio para preguntas, ideas y comentarios.\n\nSolo un ejemplo. Este evento y el enlace a la tienda no constituyen una oferta real de reserva.",
    },
    {
      ...base,
      date: dateAt(23),
      slug: "after-hours",
      title: "After hours",
      titleEs: "Después de hora",
      mode: "tickets",
      url: "https://shop.dustwave.xyz/",
      price: "$10 general admission",
      priceEs: "Entrada general $10",
      details: "A late screening for the cinema-curious",
      detailsEs: "Una función nocturna para curiosos del cine",
      description:
        "Stay a little later. A screening and a conversation in our small room on Haines Avenue.\n\nSample listing only. This is not an announced event or a ticket purchase offer.",
      descriptionEs:
        "Quédate un poco más. Una proyección y una charla en nuestra pequeña sala de Haines Avenue.\n\nSolo un ejemplo. No es un evento anunciado ni una oferta de entradas.",
    },
    {
      ...base,
      date: dateAt(-10),
      slug: "an-open-room",
      title: "An open room",
      titleEs: "Una sala abierta",
      details: "A gathering at Dust Wave",
      detailsEs: "Un encuentro en Dust Wave",
      description:
        "A sample past event showing how screenings move into the archive automatically.",
      descriptionEs:
        "Un evento pasado de ejemplo que muestra cómo las proyecciones pasan al archivo automáticamente.",
    },
  ];
  for (const input of fixtures) {
    const e = validateEvent(input);
    await db
      .prepare(
        "INSERT INTO events(id,slug,status,starts_at,ends_at,updated_at,revision,data) VALUES (?,?,?,?,?,?,?,?)",
      )
      .bind(
        e.id,
        e.slug,
        e.status,
        e.startsAt,
        e.endsAt,
        e.updatedAt,
        e.revision,
        JSON.stringify(e),
      )
      .run();
  }
}
