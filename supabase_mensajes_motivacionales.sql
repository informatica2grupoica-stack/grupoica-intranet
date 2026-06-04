-- =============================================
-- TABLA: mensajes_motivacionales
-- 110 mensajes contextualizados a licitaciones / Mercado Público
-- Correr en: Supabase → SQL Editor → New Query
-- =============================================

CREATE TABLE IF NOT EXISTS public.mensajes_motivacionales (
  id         SERIAL      PRIMARY KEY,
  mensaje    TEXT        NOT NULL,
  categoria  TEXT        NOT NULL DEFAULT 'general'
             CHECK (categoria IN ('licitacion','equipo','logro','perseverancia','proposito','general')),
  activo     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_activos
  ON public.mensajes_motivacionales (activo)
  WHERE activo = true;

-- RLS: lectura pública para usuarios autenticados
ALTER TABLE public.mensajes_motivacionales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autenticados_pueden_leer"
  ON public.mensajes_motivacionales FOR SELECT
  USING (auth.role() = 'authenticated' AND activo = true);

-- ─── 110 mensajes ─────────────────────────────────────────────────────────────
INSERT INTO public.mensajes_motivacionales (mensaje, categoria) VALUES

-- ── LICITACIONES (20) ──────────────────────────────────────────────────────
('Cada licitación ganada es el resultado de horas de preparación que nadie más vio. Tu trabajo importa.', 'licitacion'),
('En Mercado Público, la diferencia entre ganar y quedar segundo es el detalle. Hoy cuida los detalles.', 'licitacion'),
('El proceso de una licitación comienza mucho antes de que se publique. La ventaja se construye ahora.', 'licitacion'),
('Las licitaciones no se ganan con suerte — se ganan con información, análisis y ejecución precisa.', 'licitacion'),
('Un buen costeo hoy puede cambiar la rentabilidad de un proyecto completo mañana.', 'licitacion'),
('La transparencia del sistema público es nuestra ventaja: quien se prepara bien, compite bien.', 'licitacion'),
('Detrás de cada adjudicación hay un equipo que no se conformó con suficientemente bueno.', 'licitacion'),
('El análisis de precios de hoy es la decisión acertada de mañana.', 'licitacion'),
('Una propuesta técnica sólida puede valer más que el precio más bajo del mercado.', 'licitacion'),
('Los plazos en licitaciones no se negocian. La organización de hoy es el éxito de mañana.', 'licitacion'),
('Cada ítem del costeo representa el compromiso de entregar exactamente lo que se prometió.', 'licitacion'),
('En el mundo de las licitaciones públicas, la reputación se construye oferta por oferta.', 'licitacion'),
('No compitas solo por precio — compite por valor. Esa es la diferencia que perdura.', 'licitacion'),
('La mejor cotización es la que llega a tiempo, bien fundamentada y sin errores.', 'licitacion'),
('Buscar el mejor precio para el Estado no es solo un negocio — es un servicio a la comunidad.', 'licitacion'),
('Cada proveedor que evaluamos hoy es una decisión que impacta proyectos reales de personas reales.', 'licitacion'),
('Conocer el mercado mejor que la competencia no es ventaja desleal — es inteligencia comercial.', 'licitacion'),
('Mercado Público no perdona el descuido, pero sí premia la consistencia y la seriedad.', 'licitacion'),
('Cada oferta que presentamos lleva el nombre de nuestro equipo. Que siempre sea digno de él.', 'licitacion'),
('La excelencia en las bases técnicas no es perfeccionismo — es respeto por el trabajo bien hecho.', 'licitacion'),

-- ── EQUIPO (20) ──────────────────────────────────────────────────────────────
('Los mejores equipos no son los que nunca se equivocan — son los que aprenden más rápido juntos.', 'equipo'),
('Cuando uno sube, todos subimos. Ese es el único equipo que vale la pena integrar.', 'equipo'),
('Tu compañero no es tu competencia — el mercado sí lo es. Apóyense.', 'equipo'),
('Un equipo que se comunica bien supera a cualquier individuo brillante que trabaja solo.', 'equipo'),
('Las victorias individuales son temporales. Las victorias de equipo construyen culturas duraderas.', 'equipo'),
('Preguntar no es señal de debilidad — es señal de que te importa hacer bien el trabajo.', 'equipo'),
('El respeto por el tiempo del compañero es la forma más concreta de trabajo en equipo.', 'equipo'),
('El talento te lleva a la puerta. El equipo te lleva al otro lado.', 'equipo'),
('Compartir conocimiento no te hace prescindible — te hace valioso para todos.', 'equipo'),
('Un buen ambiente de trabajo no es un lujo — es la condición para el rendimiento sostenido.', 'equipo'),
('Los equipos de alto rendimiento tienen algo en común: se dicen la verdad con respeto.', 'equipo'),
('La confianza dentro del equipo es el activo más difícil de construir y el más fácil de perder.', 'equipo'),
('En proyectos grandes, la coordinación vale más que la inteligencia individual sin conexión.', 'equipo'),
('Un equipo que se cuida mutuamente no necesita motivación externa — se motiva solo.', 'equipo'),
('Celebrar los logros del compañero cuesta nada y significa todo para quien los recibe.', 'equipo'),
('La diversidad de perspectivas no complica el trabajo — lo enriquece y lo hace más robusto.', 'equipo'),
('Trabajar bien con otros no es una habilidad blanda — es la habilidad más importante.', 'equipo'),
('Cada persona en este equipo tiene algo que los demás necesitan. Búscalo y aprovéchalo.', 'equipo'),
('Una victoria que celebramos juntos vale diez veces más que la que guardamos para uno solo.', 'equipo'),
('El liderazgo real no es mandar — es hacer que los demás quieran dar lo mejor de sí.', 'equipo'),

-- ── LOGROS (20) ──────────────────────────────────────────────────────────────
('Cada licitación adjudicada fue alguna vez solo una posibilidad. Hoy es un logro concreto.', 'logro'),
('El progreso silencioso también es progreso. Sigue avanzando aunque nadie lo note todavía.', 'logro'),
('Los resultados grandes siempre empiezan con decisiones pequeñas bien tomadas cada día.', 'logro'),
('Mirar hacia atrás y ver lo lejos que has llegado es el mejor combustible para seguir.', 'logro'),
('Cada error corregido es una versión mejorada de ti mismo en funcionamiento.', 'logro'),
('El éxito no es la ausencia de fracasos — es la suma de intentos que siguieron a cada caída.', 'logro'),
('Un trabajo bien terminado, aunque nadie lo elogie, fue bien terminado igual. Eso cuenta.', 'logro'),
('La disciplina de hoy es el logro de mañana que vas a celebrar.', 'logro'),
('No subestimes el valor de mantener el estándar cuando nadie está mirando.', 'logro'),
('El crecimiento profesional no es lineal — pero siempre apunta hacia adelante.', 'logro'),
('Cada proyecto entregado en tiempo y forma es una promesa cumplida. Y eso tiene peso.', 'logro'),
('Estar orgulloso de tu trabajo no es arrogancia — es respeto propio bien fundado.', 'logro'),
('Una semana difícil que se superó enseña más que un mes de comodidad sin desafíos.', 'logro'),
('El talento sin esfuerzo es potencial desperdiciado. Tú eliges en qué convertirte cada día.', 'logro'),
('La excelencia no es un destino — es un hábito que se practica todos los días sin excepción.', 'logro'),
('No esperes el reconocimiento para dar lo mejor de ti — ese es el nivel más alto posible.', 'logro'),
('Cada habilidad que tienes hoy fue aprendida una vez. Nunca pares de aprender.', 'logro'),
('Los logros que más importan son los que mejoran la realidad de otros, no solo la tuya.', 'logro'),
('Anotar lo logrado hoy te recuerda mañana exactamente por qué empezaste este camino.', 'logro'),
('No necesitas ser perfecto para avanzar — solo necesitas ser más claro que ayer.', 'logro'),

-- ── PERSEVERANCIA (20) ────────────────────────────────────────────────────────
('Las propuestas que no ganamos nos enseñaron exactamente lo que necesitábamos saber.', 'perseverancia'),
('La constancia silenciosa vence a los arranques brillantes que no duran en el tiempo.', 'perseverancia'),
('Cuando el día está cuesta arriba, recuerda: todos los días llegan a su fin.', 'perseverancia'),
('La paciencia estratégica no es esperar — es seguir trabajando mientras esperas el resultado.', 'perseverancia'),
('Los proyectos grandes se ejecutan un día a la vez. Hoy es uno de esos días que suman.', 'perseverancia'),
('Las dificultades de hoy son las historias de aprendizaje que contarás mañana.', 'perseverancia'),
('No te midas con el que ya llegó — mídete con quien eras la semana pasada.', 'perseverancia'),
('Cuando no ves avance, confía en el proceso. Las raíces crecen antes que el árbol.', 'perseverancia'),
('La resiliencia no es no caerse — es saber levantarse sin dramatismo y seguir adelante.', 'perseverancia'),
('Un mercado exigente es una invitación a ser mejor, no una razón para abandonar.', 'perseverancia'),
('Los que perseveran no siempre son los más talentosos — son los más honestos con el proceso.', 'perseverancia'),
('Incluso en los días grises, el equipo sigue siendo el equipo. Eso no cambia.', 'perseverancia'),
('El problema de hoy tiene solución. A veces la solución llega mañana con mente descansada.', 'perseverancia'),
('Hacer bien lo difícil cuando es fácil hacerlo mal — eso es carácter profesional real.', 'perseverancia'),
('No existe el fracaso definitivo mientras sigas en el juego y aprendas de cada intento.', 'perseverancia'),
('La presión da forma a los diamantes, no porque sea agradable, sino porque es necesaria.', 'perseverancia'),
('Un día complicado no define una carrera. Pero cómo lo enfrentas sí deja huella.', 'perseverancia'),
('Sigue. Aunque estés cansado. Aunque tengas dudas. Sigue un paso más.', 'perseverancia'),
('El mejor momento para no darse por vencido es exactamente este: ahora mismo.', 'perseverancia'),
('No todo se resuelve hoy. Lo importante es no soltar el hilo y volver mañana.', 'perseverancia'),

-- ── PROPÓSITO (15) ────────────────────────────────────────────────────────────
('Trabajar para el sector público tiene un significado mayor: lo que hacemos afecta vidas reales.', 'proposito'),
('Detrás de cada licitación pública hay una escuela, un hospital, una comunidad. Eso importa mucho.', 'proposito'),
('El propósito no te hace invencible — te hace inamovible frente a las dificultades.', 'proposito'),
('Cada producto que cotizamos con honestidad es una decisión ética, no solo comercial.', 'proposito'),
('La integridad en negocios públicos no es opcional — es el fundamento de todo lo que construimos.', 'proposito'),
('Cuando el propósito es claro, las tareas difíciles se vuelven solo eso: tareas a cumplir.', 'proposito'),
('Hacer bien tu trabajo en el anonimato es el estándar más alto que cualquiera puede fijar.', 'proposito'),
('La confianza del cliente no se compra — se gana entrega por entrega, sin excepciones.', 'proposito'),
('Nuestro trabajo conecta recursos públicos con necesidades reales. Ese es un privilegio.', 'proposito'),
('Ser honestos en la cotización es también ser honestos con nosotros mismos.', 'proposito'),
('El impacto de un buen proveedor se mide en proyectos completados, no en promesas vacías.', 'proposito'),
('Una empresa con propósito claro atrae personas con propósito claro. Los dos se necesitan.', 'proposito'),
('Ser parte de un equipo con valores claros es un privilegio, no un derecho. Cuídalo.', 'proposito'),
('Las empresas que perduran son las que saben exactamente por qué hacen lo que hacen.', 'proposito'),
('Contribuir a que el Estado use bien sus recursos es una forma concreta de servicio público.', 'proposito'),

-- ── GENERAL (15) ──────────────────────────────────────────────────────────────
('El buen ánimo es contagioso — y en un equipo de trabajo, es perfectamente estratégico.', 'general'),
('Hoy es un buen día para hacer una cosa especialmente bien. Solo una, pero de verdad.', 'general'),
('No necesitas inspiración para empezar — solo necesitas empezar. La inspiración llega después.', 'general'),
('La claridad mental comienza con una lista honesta de lo más importante del día.', 'general'),
('Organizar bien la jornada de hoy es el regalo más concreto que le puedes hacer al yo de mañana.', 'general'),
('Tratar bien a las personas no cuesta nada y construye todo lo que importa.', 'general'),
('La primera pregunta del día: ¿qué es lo más importante que puedo hacer en las próximas horas?', 'general'),
('Un saludo genuino al equipo puede cambiar el tono de toda la jornada laboral.', 'general'),
('Lo que haces hoy es lo que serás mañana. Elige con consciencia.', 'general'),
('Las pequeñas victorias del día también merecen reconocimiento. Dáselas a ti mismo.', 'general'),
('La curiosidad es el motor más eficiente que existe. ¿Qué aprendiste hoy?', 'general'),
('Un buen día de trabajo es también una forma muy concreta de autocuidado.', 'general'),
('El profesionalismo es el hábito de hacer las cosas bien aunque nadie esté mirando.', 'general'),
('Un descanso tomado a tiempo es tan productivo como horas extras bien aprovechadas.', 'general'),
('La primera señal de excelencia es preocuparse por si lo que entregas es realmente bueno.', 'general');
