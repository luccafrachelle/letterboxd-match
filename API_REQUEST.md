Para: api@letterboxd.com
Asunto: API access request – "Pelis en común", a two-profile comparison tool

Hi Letterboxd team,

I'm a Letterboxd member (letterboxd.com/frache04) and I built a small, non-commercial web app that compares two public profiles:

- films both members have watched (with each person's rating), and
- films that are on both members' watchlists, so friends can pick something to watch together.

Results can be viewed as a grid/list and exported to Excel. It's open source:
- Live: https://letterboxd-match-jet.vercel.app
- Code: https://github.com/luccafrachelle/letterboxd-match

Today it reads the public HTML pages, which only gives me the first page of each member's watched films. I'd much rather use the official API so the app is reliable, complete and respectful of your infrastructure.

What I'd need (read-only, public data only, no login or writes):
- A member's watched films (film relationships) and their ratings
- A member's watchlist
- Film posters and basic metadata (title, year, link)

Expected usage is low: a few hundred comparisons per month among friends. I'd cache responses, link every film back to its Letterboxd page, credit Letterboxd clearly, and follow your API terms and branding guidelines.

Thanks for considering it!

Lucca
