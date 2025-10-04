import pkg from "pg";
import dotenv from "dotenv/config";

const { Pool } = pkg;

// Connect to your Neon/Postgres database
const pool = new Pool({
  connectionString: process.env.DATABASE_DEV_URL,
});

async function seed() {
  try {
    const topics = [
        {
          "topicid": "A01",
          "topic_name": "Algebraic methods",
          "parent_topic": null
        },
        {
          "topicid": "A01.1",
          "topic_name": "Proof by contradiction",
          "parent_topic": "A01"
        },
        {
          "topicid": "A01.2",
          "topic_name": "Algebraic fractions",
          "parent_topic": "A01"
        },
        {
          "topicid": "A01.3",
          "topic_name": "Partial fractions",
          "parent_topic": "A01"
        },
        {
          "topicid": "A01.4",
          "topic_name": "Repeated factors",
          "parent_topic": "A01"
        },
        {
          "topicid": "A01.5",
          "topic_name": "Algebraic division",
          "parent_topic": "A01"
        },
        {
          "topicid": "A02",
          "topic_name": "Functions and graphs",
          "parent_topic": null
        },
        {
          "topicid": "A02.1",
          "topic_name": "The modulus function",
          "parent_topic": "A02"
        },
        {
          "topicid": "A02.2",
          "topic_name": "Functions and mappings",
          "parent_topic": "A02"
        },
        {
          "topicid": "A02.3",
          "topic_name": "Composite functions",
          "parent_topic": "A02"
        },
        {
          "topicid": "A02.4",
          "topic_name": "Inverse functions",
          "parent_topic": "A02"
        },
        {
          "topicid": "A02.5",
          "topic_name": "y = |f(x)| and y = f(|x|)",
          "parent_topic": "A02"
        },
        {
          "topicid": "A02.6",
          "topic_name": "Combining transformations",
          "parent_topic": "A02"
        },
        {
          "topicid": "A02.7",
          "topic_name": "Solving modulus problems",
          "parent_topic": "A02"
        },
        {
          "topicid": "A03",
          "topic_name": "Sequences and series",
          "parent_topic": null
        },
        {
          "topicid": "A03.1",
          "topic_name": "Arithmetic sequences",
          "parent_topic": "A03"
        },
        {
          "topicid": "A03.2",
          "topic_name": "Arithmetic series",
          "parent_topic": "A03"
        },
        {
          "topicid": "A03.3",
          "topic_name": "Geometric sequences",
          "parent_topic": "A03"
        },
        {
          "topicid": "A03.4",
          "topic_name": "Geometric series",
          "parent_topic": "A03"
        },
        {
          "topicid": "A03.5",
          "topic_name": "Sum to infinity",
          "parent_topic": "A03"
        },
        {
          "topicid": "A03.6",
          "topic_name": "Sigma notation",
          "parent_topic": "A03"
        },
        {
          "topicid": "A03.7",
          "topic_name": "Recurrence relations",
          "parent_topic": "A03"
        },
        {
          "topicid": "A03.8",
          "topic_name": "Modelling with series",
          "parent_topic": "A03"
        },
        {
          "topicid": "A04",
          "topic_name": "Binomial expansion",
          "parent_topic": null
        },
        {
          "topicid": "A04.1",
          "topic_name": "Expanding (1 + x)^n",
          "parent_topic": "A04"
        },
        {
          "topicid": "A04.2",
          "topic_name": "Expanding (a + bx)^n",
          "parent_topic": "A04"
        },
        {
          "topicid": "A04.3",
          "topic_name": "Using partial fractions",
          "parent_topic": "A04"
        },
        {
          "topicid": "A05",
          "topic_name": "Radians",
          "parent_topic": null
        },
        {
          "topicid": "A05.1",
          "topic_name": "Radian measure",
          "parent_topic": "A05"
        },
        {
          "topicid": "A05.2",
          "topic_name": "Arc length",
          "parent_topic": "A05"
        },
        {
          "topicid": "A05.3",
          "topic_name": "Areas of sectors and segments",
          "parent_topic": "A05"
        },
        {
          "topicid": "A05.4",
          "topic_name": "Solving trigonometric equations (radians)",
          "parent_topic": "A05"
        },
        {
          "topicid": "A05.5",
          "topic_name": "Small angle approximations",
          "parent_topic": "A05"
        },
        {
          "topicid": "A06",
          "topic_name": "Trigonometric functions",
          "parent_topic": null
        },
        {
          "topicid": "A06.1",
          "topic_name": "Secant, cosecant and cotangent",
          "parent_topic": "A06"
        },
        {
          "topicid": "A06.2",
          "topic_name": "Graphs of sec x, cosec x and cot x",
          "parent_topic": "A06"
        },
        {
          "topicid": "A06.3",
          "topic_name": "Using sec x, cosec x and cot x",
          "parent_topic": "A06"
        },
        {
          "topicid": "A06.4",
          "topic_name": "Trigonometric identities",
          "parent_topic": "A06"
        },
        {
          "topicid": "A06.5",
          "topic_name": "Inverse trigonometric functions",
          "parent_topic": "A06"
        },
        {
          "topicid": "A07",
          "topic_name": "Trigonometry and modelling",
          "parent_topic": null
        },
        {
          "topicid": "A07.1",
          "topic_name": "Addition formulae",
          "parent_topic": "A07"
        },
        {
          "topicid": "A07.2",
          "topic_name": "Using the angle addition formulae",
          "parent_topic": "A07"
        },
        {
          "topicid": "A07.3",
          "topic_name": "Double-angle formulae",
          "parent_topic": "A07"
        },
        {
          "topicid": "A07.4",
          "topic_name": "Solving trigonometric equations (modelling)",
          "parent_topic": "A07"
        },
        {
          "topicid": "A07.5",
          "topic_name": "Simplifying a cos x ± b sin x",
          "parent_topic": "A07"
        },
        {
          "topicid": "A07.6",
          "topic_name": "Proving trigonometric identities",
          "parent_topic": "A07"
        },
        {
          "topicid": "A07.7",
          "topic_name": "Modelling with trigonometric functions",
          "parent_topic": "A07"
        },
        {
          "topicid": "A08",
          "topic_name": "Parametric equations",
          "parent_topic": null
        },
        {
          "topicid": "A08.1",
          "topic_name": "Introduction to parametric equations",
          "parent_topic": "A08"
        },
        {
          "topicid": "A08.2",
          "topic_name": "Parametric equations using trigonometric identities",
          "parent_topic": "A08"
        },
        {
          "topicid": "A08.3",
          "topic_name": "Curve sketching",
          "parent_topic": "A08"
        },
        {
          "topicid": "A08.4",
          "topic_name": "Points of intersection",
          "parent_topic": "A08"
        },
        {
          "topicid": "A08.5",
          "topic_name": "Modelling with parametric equations",
          "parent_topic": "A08"
        },
        {
          "topicid": "A09",
          "topic_name": "Differentiation",
          "parent_topic": null
        },
        {
          "topicid": "A09.1",
          "topic_name": "Differentiating sin x and cos x",
          "parent_topic": "A09"
        },
        {
          "topicid": "A09.2",
          "topic_name": "Differentiating exponentials and logarithms",
          "parent_topic": "A09"
        },
        {
          "topicid": "A09.3",
          "topic_name": "The chain rule",
          "parent_topic": "A09"
        },
        {
          "topicid": "A09.4",
          "topic_name": "The product rule",
          "parent_topic": "A09"
        },
        {
          "topicid": "A09.5",
          "topic_name": "The quotient rule",
          "parent_topic": "A09"
        },
        {
          "topicid": "A09.6",
          "topic_name": "Differentiating trigonometric functions",
          "parent_topic": "A09"
        },
        {
          "topicid": "A09.7",
          "topic_name": "Parametric differentiation",
          "parent_topic": "A09"
        },
        {
          "topicid": "A09.8",
          "topic_name": "Implicit differentiation",
          "parent_topic": "A09"
        },
        {
          "topicid": "A09.9",
          "topic_name": "Using second derivatives",
          "parent_topic": "A09"
        },
        {
          "topicid": "A09.10",
          "topic_name": "Rates of change",
          "parent_topic": "A09"
        },
        {
          "topicid": "A10",
          "topic_name": "Numerical methods",
          "parent_topic": null
        },
        {
          "topicid": "A10.1",
          "topic_name": "Locating roots",
          "parent_topic": "A10"
        },
        {
          "topicid": "A10.2",
          "topic_name": "Iteration",
          "parent_topic": "A10"
        },
        {
          "topicid": "A10.3",
          "topic_name": "The Newton-Raphson method",
          "parent_topic": "A10"
        },
        {
          "topicid": "A10.4",
          "topic_name": "Applications to modelling",
          "parent_topic": "A10"
        },
        {
          "topicid": "A11",
          "topic_name": "Integration",
          "parent_topic": null
        },
        {
          "topicid": "A11.1",
          "topic_name": "Integrating standard functions",
          "parent_topic": "A11"
        },
        {
          "topicid": "A11.2",
          "topic_name": "Integrating f(ax + b)",
          "parent_topic": "A11"
        },
        {
          "topicid": "A11.3",
          "topic_name": "Integration using trigonometric identities",
          "parent_topic": "A11"
        },
        {
          "topicid": "A11.4",
          "topic_name": "Reverse chain rule",
          "parent_topic": "A11"
        },
        {
          "topicid": "A11.5",
          "topic_name": "Integration by substitution",
          "parent_topic": "A11"
        },
        {
          "topicid": "A11.6",
          "topic_name": "Integration by parts",
          "parent_topic": "A11"
        },
        {
          "topicid": "A11.7",
          "topic_name": "Integration with partial fractions",
          "parent_topic": "A11"
        },
        {
          "topicid": "A11.8",
          "topic_name": "Finding areas",
          "parent_topic": "A11"
        },
        {
          "topicid": "A11.9",
          "topic_name": "The trapezium rule",
          "parent_topic": "A11"
        },
        {
          "topicid": "A11.10",
          "topic_name": "Solving differential equations",
          "parent_topic": "A11"
        },
        {
          "topicid": "A11.11",
          "topic_name": "Modelling with differential equations",
          "parent_topic": "A11"
        },
        {
          "topicid": "A11.12",
          "topic_name": "Integration as the limit of a sum",
          "parent_topic": "A11"
        },
        {
          "topicid": "A12",
          "topic_name": "Vectors",
          "parent_topic": null
        },
        {
          "topicid": "A12.1",
          "topic_name": "3D coordinates",
          "parent_topic": "A12"
        },
        {
          "topicid": "A12.2",
          "topic_name": "Vectors in 3D",
          "parent_topic": "A12"
        },
        {
          "topicid": "A12.3",
          "topic_name": "Solving geometric problems",
          "parent_topic": "A12"
        },
        {
          "topicid": "A12.4",
          "topic_name": "Application to mechanics",
          "parent_topic": "A12"
        }
    ];
    await pool.query("DELETE FROM topics;")

    for (const t of topics) {
      await pool.query(
        `INSERT INTO topics
          (topicid, topic_name, parent_topic)
         VALUES ($1, $2, $3);`,
        [t.topicid, t.topic_name, t.parent_topic]
      );
    }

    console.log("✅ Seeding complete!");
  } catch (err) {
    console.error("❌ Error seeding database:", err);
  } finally {
    await pool.end();
  }
}

seed();