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
    price: "Free admission",
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
      title: "Short films at Dust Wave",
      titleEs: "Cortos en Dust Wave",
      details: "Short films and a conversation afterward",
      detailsEs: "Cortometrajes y una charla después",
      image: "/assets/sample-shorts.svg",
      imageAlt: "Vector drawing of a five-hole film reel above a screen",
      imageAltEs:
        "Dibujo vectorial de un carrete de película de cinco orificios sobre una pantalla",
      description:
        "A few short films, followed by a chance to talk about what we watched. Come for the movies and stick around if you’d like.\n\nSample event for this preview. The date and admission details aren’t real.",
      descriptionEs:
        "Veremos unos cortos y después podremos conversar sobre ellos. Ven por las películas y quédate a charlar si te provoca.\n\nEvento de ejemplo para esta vista previa. La fecha y los datos de entrada no son reales.",
    },
    {
      ...base,
      date: dateAt(16),
      slug: "in-the-edit",
      title: "Works in progress",
      titleEs: "Películas en proceso",
      mode: "rsvp",
      url: "https://shop.dustwave.xyz/",
      price: "Free · RSVP required",
      priceEs: "Gratis · Con reserva",
      details: "Rough cuts and filmmaker feedback",
      detailsEs: "Primeros cortes y comentarios entre cineastas",
      description:
        "Watch works in progress and talk through them with other filmmakers. There’s still time to change the edit.\n\nThis is a sample event. The RSVP link is only a placeholder.",
      descriptionEs:
        "Veremos películas en proceso y las conversaremos con otros cineastas. Todavía hay tiempo de cambiar el montaje.\n\nEste es un evento de ejemplo. El enlace no permite hacer una reserva real.",
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
      details: "An evening screening at the studio",
      detailsEs: "Una función de noche en el estudio",
      description:
        "A movie at the studio, with time to hang out afterward. We’ll have snacks and drinks for sale.\n\nThis is a sample event. No tickets are on sale.",
      descriptionEs:
        "Una película en el estudio y un rato para conversar después. Tendremos snacks y bebidas a la venta.\n\nEste es un evento de ejemplo. No hay entradas a la venta.",
    },
    {
      ...base,
      date: dateAt(-10),
      slug: "an-open-room",
      title: "A night at Dust Wave",
      titleEs: "Una noche en Dust Wave",
      details: "A screening at the studio",
      detailsEs: "Una proyección en el estudio",
      description:
        "This sample event shows where past screenings appear once they’re over.",
      descriptionEs:
        "Este ejemplo muestra dónde aparecen las funciones cuando terminan.",
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
