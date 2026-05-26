from google import genai

client = genai.Client(api_key="AIzaSyAFmrX9ecnudpS1PKVCe1Zw1dMKoD5ZtNc")

response = client.models.generate_content(
    model    = "gemini-2.5-flash",
    contents = "Say hello in one sentence"
)
print(response.text)