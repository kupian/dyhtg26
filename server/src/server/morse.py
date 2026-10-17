from server.exceptions import EncodingError

decode = {
          " ":  " ",
          ".-": "a",
          "-...": "b",
          "-.-.": "c",
          "-..": "d",
          ".": "e",
          "..-.": "f",
          "--.": "g",
          "....": "h",
          "..": "i",
          ".---": "j",
          "-.-": "k",
          ".-..": "l",
          "--": "m",
          "-.": "n",
          "---": "o",
          ".--.": "p",
          "--.-": "q",
          ".-.": "r",
          "...": "s",
          "-": "t",
          "..-": "u",
          "...-": "v",
          ".--": "w",
          "-..-": "x",
          "-.--": "y",
          "--..": "z",
          "-----": "0",
          ".----": "1",
          "..---": "2",
          "...--": "3",
          "....-": "4",
          ".....": "5",
          "-....": "6",
          "--...": "7",
          "---..": "8",
          "----.": "9"}

encode = {v: k for k, v in decode.items()}

def encode_sentence(ascii_sentence: str) -> str:
    final_sentence = ""
    for c in ascii_sentence:
        try:
            final_sentence += encode[c]
        except KeyError as e:
            raise EncodingError(f"Could not encode {c} as morse")

    return final_sentence

def decode_sentence(morse_sentence: str) -> str:
    final_sentence = ""
    for w in morse_sentence.split(" "):
        try:
            final_sentence += decode[w]
        except KeyError as e:
            raise EncodingError(f"Could not decode {w} as ascii")

    return final_sentence