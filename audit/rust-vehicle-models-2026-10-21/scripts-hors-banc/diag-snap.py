import sys, json, os
pid = sys.argv[1]
out = {}
for tid in os.listdir(f'/proc/{pid}/task'):
    st = open(f'/proc/{pid}/task/{tid}/stat').read()
    comm = st[st.index('(')+1:st.rindex(')')]
    f = st[st.rindex(')')+2:].split()
    ut, stime = int(f[11]), int(f[12])
    sw = {}
    for line in open(f'/proc/{pid}/task/{tid}/status'):
        if 'ctxt_switches' in line:
            k, v = line.split(':'); sw[k] = int(v)
    out[tid] = {'comm': comm, 'utime': ut, 'stime': stime, **sw}
print(json.dumps(out))
