import json
import re
import sys
from pathlib import Path

import pdfplumber


DATE_RE = re.compile(r"^20\d\d-\d\d-\d\d$")
TIME_RE = re.compile(r"^\d\d:\d\d:\d\d$")

COLUMNS = [
    ("date", 0, 95),
    ("start", 95, 143),
    ("end", 143, 190),
    ("room", 190, 255),
    ("track", 255, 333),
    ("title", 333, 445),
    ("presenter", 445, 512),
    ("format", 512, 557),
    ("authors", 557, 678),
    ("abstract", 678, 2000),
]

HEADER_WORDS = {
    "Date",
    "Start",
    "End",
    "Room",
    "Track",
    "Title",
    "Confrimed",
    "Confirmed",
    "Format",
    "Authors",
    "Abstract",
    "Time",
    "Presenter",
}


def append_text(record, field, text):
    if text:
        record[field] = f"{record.get(field, '')} {text}".strip()


def normalize_spaces(value):
    return re.sub(r"\s+", " ", value or "").strip()


def clean_record(record):
    for field in record:
        if isinstance(record[field], str):
            record[field] = normalize_spaces(record[field])

    record["dateLabel"] = record["date"]
    record["startLabel"] = record["start"][:5]
    record["endLabel"] = record["end"][:5]
    record["dayKey"] = record["date"]
    record["searchText"] = normalize_spaces(
        " ".join(
            record.get(field, "")
            for field in ["date", "start", "end", "room", "track", "title", "authors", "abstract"]
        ).lower()
    )
    return record


def line_groups(words):
    groups = []
    for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
        if not groups or abs(groups[-1][0] - word["top"]) > 3:
            groups.append([word["top"], [word]])
        else:
            groups[-1][1].append(word)
    return groups


def extract_schedule(pdf_path):
    records = []
    current = None

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words(
                x_tolerance=2,
                y_tolerance=3,
                keep_blank_chars=False,
                use_text_flow=False,
            ) or []
            words = [
                word
                for word in words
                if word["top"] > 95 and word["text"] not in HEADER_WORDS
            ]

            for _, line_words in line_groups(words):
                columns = {name: [] for name, _, _ in COLUMNS}
                for word in line_words:
                    for name, x0, x1 in COLUMNS:
                        if x0 <= word["x0"] < x1:
                            columns[name].append(word["text"])
                            break

                texts = {name: " ".join(values).strip() for name, values in columns.items()}
                if DATE_RE.match(texts["date"]):
                    current = {
                        "id": f"s{len(records) + 1}",
                        "date": texts["date"],
                        "start": texts["start"],
                        "end": texts["end"],
                        "room": "",
                        "track": "",
                        "title": "",
                        "presenter": "",
                        "format": "",
                        "authors": "",
                        "abstract": "",
                    }
                    records.append(current)
                    for field in ["room", "track", "title", "presenter", "format", "authors", "abstract"]:
                        append_text(current, field, texts[field])
                elif current:
                    for field in ["room", "track", "title", "presenter", "format", "authors", "abstract"]:
                        append_text(current, field, texts[field])

    valid_records = [
        clean_record(record)
        for record in records
        if TIME_RE.match(record["start"]) and TIME_RE.match(record["end"]) and record["title"]
    ]
    return sorted(valid_records, key=lambda item: (item["date"], item["start"], item["room"], item["title"]))


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: extract_schedule.py input.pdf output.json")

    pdf_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    records = extract_schedule(pdf_path)
    payload = {
        "conference": "ISMB/ECCB 2025",
        "source": pdf_path.name,
        "generatedFrom": "PDF table extraction",
        "sessionCount": len(records),
        "sessions": records,
    }
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} sessions to {output_path}")


if __name__ == "__main__":
    main()
