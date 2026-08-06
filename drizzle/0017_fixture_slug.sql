ALTER TABLE `fixtures` ADD `slug` text;

UPDATE fixtures SET slug =
  replace(replace(replace(replace(replace(replace(replace(
    lower(opponent),
    ' ', '-'), '.', ''), '''', ''), '&', '-'), '/', '-'), '(', ''), ')', ''
  ) || '-' ||
  CAST(CAST(strftime('%d', kickoff, 'unixepoch') AS INTEGER) AS TEXT) || '-' ||
  CASE strftime('%m', kickoff, 'unixepoch')
    WHEN '01' THEN 'jan' WHEN '02' THEN 'feb' WHEN '03' THEN 'mar'
    WHEN '04' THEN 'apr' WHEN '05' THEN 'may' WHEN '06' THEN 'jun'
    WHEN '07' THEN 'jul' WHEN '08' THEN 'aug' WHEN '09' THEN 'sep'
    WHEN '10' THEN 'oct' WHEN '11' THEN 'nov' WHEN '12' THEN 'dec'
  END || '-' ||
  strftime('%Y', kickoff, 'unixepoch');
