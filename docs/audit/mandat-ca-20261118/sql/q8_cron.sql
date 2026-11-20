select j.jobid, j.jobname, j.schedule, j.active, replace(j.command,E'\n',' ') command,
 (select max(start_time) from cron.job_run_details d where d.jobid=j.jobid) last_run,
 (select status from cron.job_run_details d where d.jobid=j.jobid order by start_time desc limit 1) last_status
from cron.job j order by 1;
