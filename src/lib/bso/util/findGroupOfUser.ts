export async function findGroupOfUser(userID: string) {
	try {
		const user = await roboChimpClient.user.findUnique({
			where: {
				id: BigInt(userID)
			}
		});
		if (!user || !user.user_group_id) return [userID];
		const group = await roboChimpClient.user.findMany({
			where: {
				user_group_id: user.user_group_id
			}
		});
		if (!group || group.length === 0) return [userID];
		return group.map(u => u.id.toString());
	} catch {
		return [userID];
	}
}
