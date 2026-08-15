import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTROLLER,
  LEGAL_MINIMUM_AGE,
  type LocalizedDoc,
} from "./types";

export const TERMS_DOC: LocalizedDoc = {
  es: {
    title: "Términos del servicio",
    updated: "15 de agosto de 2026",
    intro: [
      `Estos términos son el acuerdo entre tú y ${LEGAL_CONTROLLER} por el uso de Fantasy LDF. Al crear una cuenta los aceptas. Si no estás de acuerdo con alguno, no uses la aplicación.`,
    ],
    sections: [
      {
        heading: "Qué es esto",
        paragraphs: [
          "Fantasy LDF es un juego de fútbol fantasy sobre la Liga Dominicana de Fútbol. Es gratuito y se juega por diversión.",
          "No es una casa de apuestas. No se paga por participar, no hay premios en dinero ni en especie, y no puedes ganar ni perder nada de valor jugando. Los puntos y las clasificaciones no tienen ningún valor monetario.",
          "No estamos afiliados a la Liga Dominicana de Fútbol, ni a sus clubes, ni a ninguna de las personas que aparecen en el juego, ni contamos con su patrocinio o aval. Los nombres de clubes y jugadores se usan solo para identificar a quién corresponde cada dato deportivo.",
        ],
      },
      {
        heading: "Tu cuenta",
        bullets: [
          `Tienes que tener al menos ${LEGAL_MINIMUM_AGE} años. Si vives en el Espacio Económico Europeo y tienes menos de 16, necesitas permiso de tu padre, madre o tutor.`,
          "Una cuenta por persona. Crear varias para tener más equipos en la misma competición no está permitido.",
          "Tú eres responsable de tu contraseña y de lo que se haga desde tu cuenta. Si crees que alguien entró, cámbiala y avísanos.",
          "Los datos que nos des tienen que ser ciertos, empezando por un correo al que realmente tengas acceso.",
        ],
      },
      {
        heading: "Cómo hay que comportarse",
        paragraphs: ["Al usar Fantasy LDF te comprometes a no hacer nada de esto:"],
        bullets: [
          "Poner nombres de equipo o de liga ofensivos, insultantes, discriminatorios, obscenos, o que suplanten a otra persona o marca.",
          "Usar programas, scripts o cualquier método automatizado para jugar, extraer datos o crear cuentas.",
          "Intentar acceder a datos que no son tuyos, incluidas las alineaciones de otros antes de que cierre la jornada.",
          "Atacar el servicio, saturarlo con peticiones, buscar agujeros de seguridad sin permiso o aprovechar un fallo en lugar de reportarlo.",
          "Usar la aplicación para acosar a alguien, o para cualquier fin ilegal.",
        ],
      },
      {
        heading: "Lo que tú publicas",
        paragraphs: [
          "El nombre de tu equipo y el de las ligas que crees son visibles para otros participantes. Sigues siendo su dueño; al ponerlos nos autorizas únicamente a mostrarlos dentro del juego.",
          "Podemos cambiar o eliminar un nombre que incumpla las reglas de arriba, y avisarte de ello.",
        ],
      },
      {
        heading: "Los resultados y los puntos",
        paragraphs: [
          "Las estadísticas de los partidos las introduce un administrador a mano. Vamos a poner cuidado, pero pueden contener errores.",
          "Podemos corregir estadísticas, recalcular los puntos de una jornada y rehacer las clasificaciones cuando aparezca un error, incluso después de haber cerrado la jornada. La versión corregida es la que vale.",
          "Las reglas del juego —presupuesto, tamaño de la plantilla, puntuación, fichajes— pueden ajustarse entre temporadas o, si hace falta, durante una. Las reglas vigentes están siempre publicadas en la página de Reglas dentro de la aplicación.",
        ],
      },
      {
        heading: "Disponibilidad",
        paragraphs: [
          "La aplicación se ofrece tal como está. No prometemos que vaya a estar siempre disponible, ni libre de fallos, ni que los datos sean exactos.",
          "Podemos cambiarla, interrumpirla temporalmente o cerrarla en cualquier momento. Si vamos a cerrarla del todo, avisaremos con antelación razonable dentro de la aplicación.",
        ],
      },
      {
        heading: "Suspensión y cierre de cuentas",
        paragraphs: [
          "Podemos suspender o eliminar una cuenta que incumpla estos términos. Cuando sea posible te lo diremos antes y te explicaremos por qué.",
          "Tú puedes borrar la tuya cuando quieras desde Más → Eliminar mi cuenta. Al hacerlo se eliminan tu perfil, tu equipo, tus alineaciones y tus fichajes, y no hay vuelta atrás.",
        ],
      },
      {
        heading: "Responsabilidad",
        paragraphs: [
          "Hasta donde la ley lo permita, no respondemos por daños indirectos derivados del uso de la aplicación, ni por errores en las estadísticas, ni por la pérdida de datos o de puntos.",
          "Nada en estos términos limita los derechos que la ley te reconoce como consumidor y que no se pueden renunciar.",
        ],
      },
      {
        heading: "Cambios",
        paragraphs: [
          "Podemos modificar estos términos. La fecha de arriba indica la última versión, y si el cambio es importante lo avisaremos dentro de la aplicación. Seguir usando el juego después de un cambio significa que lo aceptas.",
        ],
      },
      {
        heading: "Ley aplicable y contacto",
        paragraphs: [
          "Estos términos se rigen por las leyes de la República Dominicana, y los tribunales de Santo Domingo son los competentes, sin perjuicio de los derechos que te correspondan por vivir en otro país.",
          `Para cualquier duda escribe a ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  en: {
    title: "Terms of service",
    updated: "15 August 2026",
    intro: [
      `These terms are the agreement between you and ${LEGAL_CONTROLLER} for using Fantasy LDF. Creating an account means you accept them. If you disagree with any of them, don't use the app.`,
    ],
    sections: [
      {
        heading: "What this is",
        paragraphs: [
          "Fantasy LDF is a fantasy football game about the Dominican football league. It is free and it is played for fun.",
          "It is not gambling. There is no entry fee, no cash or physical prizes, and nothing of value can be won or lost by playing. Points and standings have no monetary value.",
          "We are not affiliated with, sponsored by or endorsed by the Dominican football league, its clubs, or any of the people who appear in the game. Club and player names are used only to identify who each piece of sporting data belongs to.",
        ],
      },
      {
        heading: "Your account",
        bullets: [
          `You must be at least ${LEGAL_MINIMUM_AGE}. If you live in the European Economic Area and are under 16, you need a parent or guardian's permission.`,
          "One account per person. Creating several to field more teams in the same competition is not allowed.",
          "You are responsible for your password and for what happens through your account. If you think someone got in, change it and tell us.",
          "The details you give us have to be true, starting with an email address you actually have access to.",
        ],
      },
      {
        heading: "How to behave",
        paragraphs: ["Using Fantasy LDF, you agree not to do any of this:"],
        bullets: [
          "Use team or league names that are offensive, abusive, discriminatory, obscene, or that impersonate another person or brand.",
          "Use programs, scripts or any automated means to play, scrape data or create accounts.",
          "Try to reach data that isn't yours, including other players' lineups before the deadline passes.",
          "Attack the service, flood it with requests, probe it for security holes without permission, or exploit a bug instead of reporting it.",
          "Use the app to harass anyone, or for any unlawful purpose.",
        ],
      },
      {
        heading: "What you post",
        paragraphs: [
          "Your team name and the names of leagues you create are visible to other players. They stay yours; by entering them you allow us to display them inside the game and nothing more.",
          "We may change or remove a name that breaks the rules above, and will tell you when we do.",
        ],
      },
      {
        heading: "Results and points",
        paragraphs: [
          "Match statistics are entered by an administrator by hand. We will be careful, but they may contain mistakes.",
          "We may correct statistics, recalculate a gameweek's points and rebuild the standings when an error turns up, including after the gameweek has closed. The corrected version is the one that counts.",
          "Game rules — budget, squad size, scoring, transfers — may be adjusted between seasons or, if it proves necessary, during one. The rules in force are always published on the Rules page inside the app.",
        ],
      },
      {
        heading: "Availability",
        paragraphs: [
          "The app is provided as it is. We don't promise it will always be up, or free of faults, or that the data will be accurate.",
          "We may change it, take it down temporarily, or close it at any time. If we are closing it for good, we will give reasonable notice inside the app.",
        ],
      },
      {
        heading: "Suspension and closure",
        paragraphs: [
          "We may suspend or delete an account that breaks these terms. Where we can, we will tell you first and explain why.",
          "You can delete yours whenever you like from More → Delete my account. Doing so removes your profile, your team, your lineups and your transfers, and cannot be undone.",
        ],
      },
      {
        heading: "Liability",
        paragraphs: [
          "As far as the law allows, we are not liable for indirect damages arising from use of the app, for errors in the statistics, or for loss of data or points.",
          "Nothing in these terms limits the rights the law gives you as a consumer and which cannot be waived.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "We may change these terms. The date above marks the latest version, and if the change is significant we will say so inside the app. Continuing to use the game after a change means you accept it.",
        ],
      },
      {
        heading: "Governing law and contact",
        paragraphs: [
          "These terms are governed by the laws of the Dominican Republic, and the courts of Santo Domingo have jurisdiction, without prejudice to any rights you have from living in another country.",
          `For any question, write to ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
};
