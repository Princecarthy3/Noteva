-- Stage 11: trusted quiz-attempt persistence is performed after server-side scoring.
grant select, insert, update on public.quizzes to service_role;
grant select, insert on public.quiz_attempts to service_role;
