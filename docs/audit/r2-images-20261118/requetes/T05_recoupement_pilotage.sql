select 'bmp_by_folder' k, pmi_folder, pmi_pm_id, count(*) from pieces_media_img where pmi_name ~* '\.bmp$' group by 2,3 order by 4 desc limit 15;
select 'folder_rows' k, pmi_folder, count(*) from pieces_media_img where pmi_folder in ('30','387') group by 2;
select 'empty_folder_display1' k, count(*) from pieces_media_img where pmi_display='1' and coalesce(pmi_folder,'')='';
