CREATE TABLE IF NOT EXISTS public.trivia_questions
(
    id SERIAL PRIMARY KEY,
    question text NOT NULL,
    options text[] NOT NULL CHECK (array_length(options, 1) = 4),
    correct_answer integer NOT NULL CHECK (correct_answer >= 0 AND correct_answer <= 3),
    explanation text NOT NULL,
    text_hint text NOT NULL,
    image_hint text,
    category text NOT NULL,
    difficulty text NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

TABLESPACE pg_default;