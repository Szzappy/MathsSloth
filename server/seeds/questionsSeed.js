import pkg from "pg";
import dotenv from "dotenv/config";

const { Pool } = pkg;

// Connect to your Neon/Postgres database
const pool = new Pool({
  connectionString: process.env.DATABASE_DEV_URL,
});

async function seed() {
  try {
    const questions = [
      {
        "topic": ["A11.1", "A11.4"],
        "question_text": "Find $\\int \\frac{x^2 (2x - 5)}{3} dx$ writing each term in simplest form.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 20,
        "marks": 4
      },
      {
        "topic": ["A01.5", "A03.3"],
        "question_text": "$g(x) = 3x^3 + 20x^2 - 1 - kx - 7x^2 + k$ where $k$ is a constant. Given that $(x - 3)$ is a factor of $g(x)$, find the value of $k$.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 20,
        "marks": 3
      },
      {
        "topic": ["A04.1", "A04.2"],
        "question_text": "(a) Find, in ascending powers of $x$, the first four terms of the binomial expansion of $(1 + 9x)^{-\\frac{1}{2}}$ giving each term in simplest form.\n\n(b) Give a reason why $x = -\\frac{2}{9}$ should not be used in the expansion to find an approximation to $\\sqrt{3}$",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 30,
        "marks": 4
      },
      {
        "topic": ["A10.1", "A10.3", "A09.1"],
        "question_text": "$f(x) = \\frac{1}{2}x - 3 - \\tan(x)$, $-\\frac{\\pi}{2} < x < \\frac{\\pi}{2}$\n\nGiven that the equation $f(x) = 0$ has a single root $\\alpha$:\n\n(a) show that $\\alpha$ lies in the interval $[3.6, 3.7]$\n\n(b) Find $f'(x)$\n\n(c) Using $3.7$ as a first approximation for $\\alpha$, apply the Newton-Raphson method once to obtain a second approximation for $\\alpha$. Give your answer to 3 decimal places.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 40,
        "marks": 6
      },
      {
        "topic": ["A09.3"],
        "question_text": "Given that $y = x^2$, use differentiation from first principles to show that $\\frac{dy}{dx} = 2x$",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 25,
        "marks": 3
      },
      {
        "topic": ["A09.5", "A02.2"],
        "question_text": "The function $f$ is defined by $f(x) = \\frac{2x^2 - 3}{x - 4}$, $x \\neq 4$\n\n(a) Show that $f'(x) = \\frac{ax^2 - bx - c}{(x - 4)^2}$ where $a$, $b$ and $c$ are constants to be found.\n\n(b) Hence, using algebra, find the values of $x$ for which $f$ is decreasing. You must show each step in your working.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 45,
        "marks": 6
      },
      {
        "topic": ["A02.1", "A02.7"],
        "question_text": "The graph has equation $y = |3x - 2| - 5$. The vertex of the graph is at point $P$.\n\n(a) Find the coordinates of $P$.\n\n(b) Solve the equation $16 = |4(3x - 2) - 5|$\n\nA line $l$ has equation $y = kx + 4$ where $k$ is a constant. Given that $l$ intersects $y = |3x - 2| - 5$ at 2 distinct points,\n\n(c) find the range of values of $k$.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 40,
        "marks": 6
      },
      {
        "topic": ["A11.10", "A11.11"],
        "question_text": "A cylindrical tank of height 1.5m is initially full of water. The water starts to leak from a small hole at point L. The depth $H$ metres of water in the tank is modelled by $\\frac{dH}{dt} = -0.12e^{-0.2t}$ where $t$ hours is the time after the leak starts.\n\n(a) show that $H = A + Be^{-0.2t}$ where $A$ and $B$ are constants to be found\n\n(b) find the time taken for the depth of water to decrease to 1.2m. Give your answer in hours and minutes, to the nearest minute.\n\n(c) Find, according to the model, the height of the hole from the bottom of the tank.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 55,
        "marks": 8
      },
      {
        "topic": ["A02.2", "A02.3", "A02.4"],
        "question_text": "The functions $f$ and $g$ are defined by\n\n$f(x) = \\frac{2x - 4}{x + 3}$, $x \\neq -3$\n\n$g(x) = \\frac{5}{x - 9}$, $x \\neq 9$, $x \\geq 2$\n\n(a) Find $fg(2)$\n\n(b) Find $g^{-1}$\n\n(c) (i) Find $gf(x)$, giving your answer as a simplified fraction.\n\n(ii) Deduce the range of $gf(x)$.\n\nThe function $h$ is defined by $h(x) = 2x^2 - 6x - k$, $x \\in \\mathbb{R}$ where $k$ is a constant.\n\n(d) Find the range of values of $k$ for which the equation $f(x) = h(x)$ has no real solutions.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 60,
        "marks": 11
      },
      {
        "topic": ["A03.3", "A03.5"],
        "question_text": "The first 3 terms of a geometric sequence are\n\n$3k - 9$, $3k + 4$, $5k + 7$\n\n(a) Using algebra and making your reasoning clear, prove that $k = \\frac{5}{2}$\n\n(b) Hence find the sum to infinity of the geometric sequence.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 40,
        "marks": 6
      },
      {
        "topic": ["A09.3", "A11.8"],
        "question_text": "The curve has equation $y = 8x - x^{\\frac{5}{2}}$, $x \\geq 0$. The curve crosses the $x$-axis at point $A$.\n\n(a) Verify that the $x$ coordinate of $A$ is 4.\n\nThe line $l_1$ is the tangent to the curve at $A$.\n\n(b) Use calculus to show that an equation of line $l_1$ is $12x + y = 48$\n\nThe line $l_2$ has equation $y = 8x$. The region $R$ is bounded by the curve, the line $l_1$ and the line $l_2$.\n\n(c) Use algebraic integration to find the exact area of $R$.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 60,
        "marks": 9
      },
      {
        "topic": ["A05.3", "A11.8"],
        "question_text": "A badge design shows a semicircle ABCOA with centre $O$ and diameter 10cm. $OB$ is the arc of a circle with centre $A$ and radius 5cm. The region $R$ is bounded by the arc $OB$, the arc $BC$ and the line $OC$. Find the exact area of $R$. Give your answer in the form $(a\\sqrt{3} + b\\pi)$ cm$^2$, where $a$ and $b$ are rational numbers.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 45,
        "marks": 4
      },
      {
        "topic": ["A07.5", "A07.7"],
        "question_text": "(a) Express $140\\cos \\theta - 480 \\sin \\theta$ in the form $K\\cos(\\theta + \\alpha)$ where $K > 0$ and $0 < \\alpha < 90°$. State the value of $K$ and give the value of $\\alpha$, in degrees, to 2 decimal places.\n\nA scientist studies the number of rabbits and foxes in a wood for one year. The number of rabbits, $R$, is modelled by the equation\n\n$R = A + 140\\cos(30t)° - 480\\sin(30t)°$\n\nwhere $t$ months is the time after the start of the year and $A$ is a constant. Given that during the year, the maximum number of rabbits is 1500:\n\n(b) (i) find a complete equation for this model.\n\n(ii) Hence write down the minimum number of rabbits during the year.\n\n(c) The actual number of rabbits is at its minimum value in the middle of April. Use this information to comment on the model.\n\nThe number of foxes, $F$, is modelled by $F = 100 + 70\\sin(30t + 70)°$. The number of foxes is at its minimum value after $T$ months.\n\n(d) Find, according to the models, the number of rabbits at time $T$ months.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 65,
        "marks": 11
      },
      {
        "topic": ["A11.5", "A11.3"],
        "question_text": "(a) Given that $a$ is a positive constant, use the substitution $x = a \\sin^2\\theta$ to show that\n\n$\\int_0^a \\sqrt{a^2 - x^2} \\, dx = \\frac{a^2}{2} \\int_0^{\\frac{\\pi}{2}} \\sin 2\\theta \\, d\\theta$\n\n(b) Hence use algebraic integration to show that\n\n$\\int_0^a \\sqrt{a^2 - x^2} \\, dx = k\\pi a^2$\n\nwhere $k$ is a constant to be found.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 70,
        "marks": 8
      },
      {
        "topic": ["A11.10", "A11.11"],
        "question_text": "A balloon is being inflated. In a simple model, the balloon is modelled as a sphere and the rate of increase of the radius is inversely proportional to the square root of the radius. At time $t$ seconds, the radius is $r$ cm.\n\n(a) Write down a differential equation to model this situation.\n\nAt the instant when $t = 10$, the radius is 16 cm and is increasing at a rate of 0.9 cms$^{-1}$.\n\n(b) Solve the differential equation to show that $r^{\\frac{3}{2}} = 5t + 4.10$\n\n(c) Hence find the radius when $t = 20$. Give your answer to the nearest millimetre.\n\n(d) Suggest a limitation of the model.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 65,
        "marks": 9
      },
      {
        "topic": ["A01.1"],
        "question_text": "(i) Show that $k^2 - 4k + 5$ is positive for all real values of $k$.\n\n(ii) A student was asked to prove by contradiction that \"There are no positive integers $x$ and $y$ such that $(3x + 2y)(2x - 5y) = 28$\". The start of the student's proof shows:\n\nAssume that positive integers $x$ and $y$ exist such that $(3x + 2y)(2x - 5y) = 28$.\n\nIf $3x + 2y = 14$ and $2x - 5y = 2$, then $x = \\frac{74}{19}$, $y = \\frac{22}{19}$, which are not integers.\n\nShow the calculations and statements needed to complete the proof.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 50,
        "marks": 6
      },
      {
        "topic": ["A05.5"],
        "question_text": "Given that $\\theta$ is small and is measured in radians, use the small angle approximations to find an approximate value of $\\frac{1 - \\cos 4\\theta}{2\\sin 3\\theta}$",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 20,
        "marks": 3
      },
      {
        "topic": ["A09.3", "A09.9"],
        "question_text": "A curve $C$ has equation $y = x^2 - 2x - \\frac{24}{x}$, $x > 0$\n\n(a) Find (i) $\\frac{dy}{dx}$ (ii) $\\frac{d^2y}{dx^2}$\n\n(b) Verify that $C$ has a stationary point when $x = 4$\n\n(c) Determine the nature of this stationary point, giving a reason for your answer.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 35,
        "marks": 7
      },
      {
        "topic": ["A05.2", "A05.3"],
        "question_text": "A sector AOB of a circle has centre $O$ and radius $r$ cm. The angle AOB is $\\theta$ radians. The area of the sector AOB is 11 cm$^2$. Given that the perimeter of the sector is 4 times the length of the arc AB, find the exact value of $r$.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 30,
        "marks": 4
      },
      {
        "topic": ["A10.1", "A10.2"],
        "question_text": "The curve with equation $y = 2\\ln(8 - x)$ meets the line $y = x$ at a single point, $x = \\alpha$.\n\n(a) Show that $3 < \\alpha < 4$\n\nA student uses the iteration formula $x_{n+1} = 2\\ln(8 - x_n)$, $n \\in \\mathbb{N}$ in an attempt to find an approximation for $\\alpha$. Using the graph and starting with $x_1 = 4$\n\n(b) determine whether or not this iteration formula can be used to find an approximation for $\\alpha$, justifying your answer.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 35,
        "marks": 4
      },
      {
        "topic": ["A09.6", "A06.4"],
        "question_text": "Given that $y = \\frac{3\\sin\\theta - 3}{2\\sin\\theta + 2\\cos\\theta}$, $-\\frac{\\pi}{4} < \\theta < \\frac{\\pi}{4}$, show that $\\frac{dy}{d\\theta} = \\frac{A}{1 + \\sin 2\\theta}$, $-\\frac{\\pi}{4} < \\theta < \\frac{\\pi}{4}$ where $A$ is a rational constant to be found.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 40,
        "marks": 5
      },
      {
        "topic": ["A02.6"],
        "question_text": "The point $P(-2, -5)$ lies on the curve with equation $y = f(x)$, $x \\in \\mathbb{R}$. Find the point to which $P$ is mapped, when the curve with equation $y = f(x)$ is transformed to the curve with equation\n\n(a) $y = f(x) + 2$\n\n(b) $y = |f(x)|$\n\n(c) $y = 3f(x - 2) + 2$",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 30,
        "marks": 4
      },
      {
        "topic": ["A01.5"],
        "question_text": "$f(x) = (x - 4)(x^2 - 3x + k) - 42$ where $k$ is a constant. Given that $(x + 2)$ is a factor of $f(x)$, find the value of $k$.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 25,
        "marks": 3
      }
    ];

    await pool.query("DELETE FROM questions;")
    await pool.query("DROP TABLE IF EXISTS question_topic;")
    await pool.query(`
      CREATE TABLE question_topic (
      questionid INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
      topicid VARCHAR(255) REFERENCES topics(topicid) ON DELETE CASCADE,
      PRIMARY KEY (questionid, topicid));
      `);

    // Insert questions
    for (const q of questions) {
      const res = await pool.query(
        `INSERT INTO questions
          (question_text, image_url, format, answer, difficulty, marks)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING questionid;`,
        [q.question_text, q.image, q.format, q.answer, q.difficulty, q.marks]
      );

      const questionId = res.rows[0].questionid;

      // Insert into junction table
      for (const topicId of q.topic) {
        await pool.query(
          `INSERT INTO question_topic (questionid, topicid) VALUES ($1, $2);`,
          [questionId, topicId]
        );
      }
    }

    console.log("✅ Seeding complete!");
  } catch (err) {
    console.error("❌ Error seeding database:", err);
  } finally {
    await pool.end();
  }
}

seed();
