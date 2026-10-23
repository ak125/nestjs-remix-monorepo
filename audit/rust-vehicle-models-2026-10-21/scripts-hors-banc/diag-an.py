import json, sys
D = sys.argv[1]
res = [json.loads(l) for l in open(f'{D}/results.jsonl')]
for lat in (0, 20):
    a = json.load(open(f'{D}/snap-L{lat}-a.json')); b = json.load(open(f'{D}/snap-L{lat}-b.json'))
    r = [x for x in res if x['rep'] == 'diag2' and x['latency_ms'] == lat][0]
    n = r['rps'] * 20
    print(f"L{lat} rps={r['rps']:.1f} cpu/req(run)={r['cpu_ms_per_req']:.3f} req~{n:.0f}")
    for t in b:
        if t not in a: continue
        d = {k: b[t][k] - a[t][k] for k in ('utime', 'stime', 'voluntary_ctxt_switches', 'nonvoluntary_ctxt_switches')}
        if sum(d.values()) == 0: continue
        print(f"  {b[t]['comm']:<20} user {d['utime']*10/n:.3f}  sys {d['stime']*10/n:.3f} ms/req  vol {d['voluntary_ctxt_switches']/n:.2f}/req  invol {d['nonvoluntary_ctxt_switches']/n:.3f}/req")
