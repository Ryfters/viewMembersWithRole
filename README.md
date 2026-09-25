# viewMembersWithRole

### Installation
Check [this](https://docs.vencord.dev/installing/custom-plugins/) to install 

### Usage
Open server context menu and select View members with role

<img width="184" alt="image" src="https://github.com/user-attachments/assets/eefb2044-4f67-4acc-ab33-21fd07ed9a27" />

Now select the role you want
![image](https://github.com/user-attachments/assets/d74aec13-cdcf-4170-9c40-0d12853bf600)

Each member is listed with their nickname and their username.

### Loading members
**Load all** scrolls the member list for you, so members that were never rendered get pulled
into the cache and show up in the list.

### Exporting
**Copy role** copies the members with the selected role; **Copy all** copies every member
cached for the server. Both produce a code block you can paste straight into Discord:

```
Nickname | Username | Roles
Blanco | blancodagoat | Admin, Mod
```

Lists too long for one message are split automatically - click the button again for the next
part, the toast tells you which part you are on.

### Limitations
- Only the first hundred members per role can be fetched. This cap is enforced by Discord and
  applies to its own role member list too.
- Servers with more than ~1000 members do not send offline members to the client at all, so
  **Load all** can only reach the online ones there. Below that threshold it loads everyone.
