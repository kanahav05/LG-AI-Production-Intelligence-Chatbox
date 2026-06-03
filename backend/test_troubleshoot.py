import requests
import sys

BASE_URL = "http://localhost:8000"

def test_endpoint():
    print("=== Testing LG Troubleshooting API ===")
    
    # 1. Test a valid problem
    valid_payload = {"problem": "R1 line motor overheating"}
    print(f"\nSending valid issue: '{valid_payload['problem']}'")
    try:
        r1 = requests.post(f"{BASE_URL}/api/troubleshoot", json=valid_payload)
        r1.raise_for_status()
        res1 = r1.json()
        print(f"Status Code: {r1.status_code}")
        print(f"Manual Matches: {len(res1.get('manual_matches', []))}")
        print(f"History Matches: {len(res1.get('history_matches', []))}")
        print(f"Synthesized: {res1.get('synthesized')}")
        print(f"Response Preview:\n{res1.get('response')[:300]}...")
    except Exception as e:
        print(f"Error testing valid issue: {e}")
        print("Please ensure uvicorn is running on port 8000.")
        sys.exit(1)

    # 2. Test an unrelated problem
    unrelated_payload = {"problem": "how to bake a chocolate cake"}
    print(f"\nSending unrelated issue: '{unrelated_payload['problem']}'")
    r2 = requests.post(f"{BASE_URL}/api/troubleshoot", json=unrelated_payload)
    res2 = r2.json()
    print(f"Status Code: {r2.status_code}")
    print(f"Manual Matches: {len(res2.get('manual_matches', []))}")
    print(f"History Matches: {len(res2.get('history_matches', []))}")
    print(f"Synthesized: {res2.get('synthesized')}")
    print(f"Response: '{res2.get('response')}'")
    
    if "supervisor" in res2.get('response').lower():
        print("\nSUCCESS: Unrelated query correctly redirected to LG supervisor!")
    else:
        print("\nFAILURE: Unrelated query did not trigger supervisor alert.")

if __name__ == "__main__":
    test_endpoint()
