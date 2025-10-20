import os
import json
from flask import Flask, render_template, request, redirect, url_for, session, make_response


# -----------------------------------------------------------------------------
# Voting web application
#
# This Flask app implements a simple multi‑round elimination voting system. It
# allows regular users to select exactly three names to vote out. Votes are
# recorded per day (three days in total) and only one ballot per browser per
# round is permitted (enforced via a cookie). An admin area secured by a
# password enables management tasks such as adding or removing contestants,
# resetting the current round (which archives the top five results and
# advances to the next day) and viewing historical standings.
#
# Styling lives in ``static/css/style.css`` and uses the colour palette
# requested by the user: a vivid orange (#ff5300) accent on a dark grey
# background with white text. Templates are kept under the ``templates/``
# directory and extend a common base layout.
app = Flask(__name__)
app.secret_key = "change_this_secret_key"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data.json")
# Define a simple admin password for demonstration purposes. In a real
# deployment this should be stored securely (e.g. environment variable) and
# hashed.
ADMIN_PASSWORD = "admin123"


def default_players():
    """Return the initial list of player names supplied by the user."""
    return [
        "Chow Peerapon",
        "Diow Tanawat",
        "First Sittiwit",
        "Gain Rachavit",
        "Gift Panpaphanan",
        "Gift Pornpatch",
        "Ice Chatdaroon",
        "Krit Suppawit",
        "Va Tunva",
        "Gna Jasmin",
        "Iryn Sutha",
        "Jane Janejira",
        "Kan Patarakan",
        "Nas Patranit",
        "Ping Tanaboon",
        "Puynun Kitsadaporn",
        "Thoongpaeng Thanawan",
        "Title Nonthawat",
        "Waan Chonticha",
        "Aom Pitchakorn",
        "Arm Boonyawat",
        "Arnold Teerawat",
        "Benz Jiraphat",
        "Giffarine Pattarada",
        "Nad Tanin",
        "Petch Thanarut",
        "Prem Prem",
        "Ran Saran",
        "Gift Phasa",
        "Jan Sutamma",
        "Joey Puwanai",
        "Many Asama",
        "Nampueng",
        "Nook Monraedee",
        "P.Fhon Patteera",
        "Ticha Ticha",
        "Toey Thanawat",
        "Baimee Phatsarin",
        "Cheese Kantika",
        "Fendee Thanarin",
        "Kratae Ratchaneewan",
        "Name Pannatorn",
        "Palm Piyawat",
        "Tangmo Piyapat",
        "Toeyhorm Niratchaporn",
        "Whan Pichanan",
        "Ake Suppanat",
        "Baisri Pitchayaphon",
        "Champ Chayutpong",
        "Dew Sirada",
        "Grip Thanabut",
        "Hun Tuanhannan",
        "Namkhing Siripat",
        "Tum Thaweewat",
    ]


def initialise_data():
    """Create the data file with default structure if it doesn't exist."""
    players = default_players()
    data = {
        "players": [
            {
                "name": p,
                "votes": {"day1": 0, "day2": 0, "day3": 0},
            }
            for p in players
        ],
        # history stores the top five results for each day once a round is
        # completed and reset by the admin. It initially contains empty lists.
        "history": {"day1": [], "day2": [], "day3": []},
        # current_day is an integer from 1 to 3 indicating which round is
        # ongoing. After three rounds the value will remain 3 (no further
        # advancement occurs).
        "current_day": 1,
    }
    save_data(data)
    return data


def load_data():
    """Read the persistent data from disk, creating defaults if missing."""
    if not os.path.exists(DATA_FILE):
        return initialise_data()
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data: dict) -> None:
    """Write the data structure back to disk."""
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


def get_day_key(data: dict) -> str:
    """Return the string key (e.g. ``day1``) for the current round."""
    current_day = data.get("current_day", 1)
    return f"day{current_day}"


@app.route("/")
def index():
    """Home page showing the voting form and a link to current results."""
    data = load_data()
    day = data["current_day"]
    player_names = [player["name"] for player in data["players"]]
    return render_template("index.html", players=player_names, day=day)


@app.route("/vote", methods=["POST"])
def vote():
    """Handle submission of a vote (exactly three selections required)."""
    data = load_data()
    day_key = get_day_key(data)
    selections = request.form.getlist("players")
    # Enforce one vote per browser per day via a cookie. The key is tied to
    # the current day so that each round is independent.
    cookie_key = f"voted_{day_key}"
    if request.cookies.get(cookie_key):
        # User has already voted this round.
        return redirect(url_for("already_voted"))
    # Validate number of selections
    if len(selections) != 3:
        # Redirect back to the form if the wrong number of names were chosen
        return redirect(url_for("index"))
    # Update vote counts
    for name in selections:
        for player in data["players"]:
            if player["name"] == name:
                player["votes"][day_key] += 1
                break
    save_data(data)
    # Respond with thanks page and set a cookie to block repeat votes
    resp = make_response(redirect(url_for("thanks")))
    # Cookie expires after 48 hours to ensure it covers the entire round.
    resp.set_cookie(cookie_key, "true", max_age=60 * 60 * 48)
    return resp


@app.route("/thanks")
def thanks():
    """Simple thank you page after submitting a vote."""
    return render_template("thanks.html")


@app.route("/already_voted")
def already_voted():
    """Page shown if a user attempts to vote more than once per round."""
    return render_template("already_voted.html")


@app.route("/results")
def results():
    """Display the top five contestants for the current day."""
    data = load_data()
    day_key = get_day_key(data)
    current_day = data["current_day"]
    # Sort players by their vote count for this round
    sorted_players = sorted(
        data["players"], key=lambda p: p["votes"][day_key], reverse=True
    )
    top_five = [
        {"name": p["name"], "votes": p["votes"][day_key]} for p in sorted_players[:5]
    ]
    return render_template(
        "results.html", top5=top_five, day=current_day
    )


@app.route("/history")
def history():
    """Display archived top five results for previous rounds."""
    data = load_data()
    return render_template("history.html", history=data["history"])


@app.route("/admin", methods=["GET", "POST"])
def admin_login():
    """Admin login page. Validates password and sets session."""
    if session.get("admin"):
        return redirect(url_for("admin_dashboard"))
    error = None
    if request.method == "POST":
        password = request.form.get("password", "")
        if password == ADMIN_PASSWORD:
            session["admin"] = True
            return redirect(url_for("admin_dashboard"))
        error = "Incorrect password."
    return render_template("admin_login.html", error=error)


@app.route("/admin/dashboard", methods=["GET", "POST"])
def admin_dashboard():
    """Admin dashboard for managing contestants and rounds."""
    if not session.get("admin"):
        return redirect(url_for("admin_login"))
    data = load_data()
    current_day = data["current_day"]
    message = ""
    if request.method == "POST":
        action = request.form.get("action")
        if action == "add":
            new_name = request.form.get("new_name", "").strip()
            if new_name:
                if any(p["name"] == new_name for p in data["players"]):
                    message = f"Player '{new_name}' already exists."
                else:
                    data["players"].append(
                        {
                            "name": new_name,
                            "votes": {"day1": 0, "day2": 0, "day3": 0},
                        }
                    )
                    save_data(data)
                    message = f"Added '{new_name}'."
        elif action == "delete":
            delete_name = request.form.get("delete_name", "")
            # Remove matching players
            before_count = len(data["players"])
            data["players"] = [p for p in data["players"] if p["name"] != delete_name]
            if len(data["players"]) < before_count:
                save_data(data)
                message = f"Deleted '{delete_name}'."
            else:
                message = f"Player '{delete_name}' not found."
        elif action == "reset":
            # Archive current top 5 and prepare for next round
            day_key = get_day_key(data)
            sorted_players = sorted(
                data["players"], key=lambda p: p["votes"][day_key], reverse=True
            )
            top_five = [
                {"name": p["name"], "votes": p["votes"][day_key]}
                for p in sorted_players[:5]
            ]
            # Store top five in history
            data["history"][day_key] = top_five
            if data["current_day"] < 3:
                # Move to next day and initialise votes for that day
                data["current_day"] += 1
                next_day_key = get_day_key(data)
                for p in data["players"]:
                    # Ensure next day key exists with zero votes
                    p["votes"][next_day_key] = 0
            else:
                # If on the final day, simply reset the votes for this day
                for p in data["players"]:
                    p["votes"][day_key] = 0
            save_data(data)
            message = "Round reset and results archived."
        # Other actions could be added here
    # Reload data after any modifications
    data = load_data()
    return render_template(
        "admin_dashboard.html",
        players=data["players"],
        current_day=data["current_day"],
        history=data["history"],
        message=message,
    )


@app.route("/logout")
def logout():
    """Log the admin out by clearing the session."""
    session.pop("admin", None)
    return redirect(url_for("admin_login"))


if __name__ == "__main__":
    # When running directly, start a development server. Use the environment
    # variable PORT if set; otherwise default to 5000. The host is set to 0.0.0.0
    # so that it is accessible outside of the container if needed.
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)